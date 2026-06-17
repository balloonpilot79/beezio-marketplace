import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost } from './_lib/http';
import { extractAuthHeader, getAuthedUser, resolveProfileId } from './_lib/auth';
import { writeAuditLog } from './_lib/audit';
import { checkOrderItemReferences } from './_lib/order-guards';
import { resolveOwnedProfileIdsForUser } from './_lib/owned-profiles';

const cleanupProductRelations = async (supabaseAdmin: any, productId: string) => {
  const cleanupTasks = [
    supabaseAdmin.from('shipping_options').delete().eq('product_id', productId),
    supabaseAdmin.from('product_variants').delete().eq('product_id', productId),
    supabaseAdmin.from('imported_products').delete().eq('product_id', productId),
    supabaseAdmin.from('affiliate_products').delete().eq('product_id', productId),
    supabaseAdmin.from('seller_product_order').delete().eq('product_id', productId),
    supabaseAdmin.from('affiliate_links').delete().eq('product_id', productId),
    supabaseAdmin.from('product_reviews').delete().eq('product_id', productId),
    supabaseAdmin.from('review_helpful').delete().eq('product_id', productId),
  ];

  await Promise.allSettled(cleanupTasks);
};

const forceDeleteOrders = async (supabaseAdmin: any, orderIds: string[]) => {
  if (!orderIds.length) return;

  const nowIso = new Date().toISOString();
  const cleanupTasks = [
    supabaseAdmin.from('account_refund_history').delete().in('order_id', orderIds),
    supabaseAdmin.from('order_money_ledger').delete().in('order_id', orderIds),
    supabaseAdmin.from('payout_snapshots').delete().in('order_id', orderIds),
    supabaseAdmin.from('payout_ledger').delete().in('order_id', orderIds),
    supabaseAdmin.from('payment_distributions').delete().in('order_id', orderIds),
    supabaseAdmin.from('email_notifications').delete().in('order_id', orderIds),
    supabaseAdmin.from('delivery_tracking').delete().in('order_id', orderIds),
    supabaseAdmin.from('shipping_labels').delete().in('order_id', orderIds),
    supabaseAdmin.from('vendor_orders').delete().in('order_id', orderIds),
    supabaseAdmin.from('disputes').delete().in('order_id', orderIds),
  ];

  await Promise.allSettled(cleanupTasks);

  await supabaseAdmin
    .from('orders')
    .update({
      paid_at: null,
      status: 'canceled',
      payment_status: 'canceled',
      updated_at: nowIso,
    } as any)
    .in('id', orderIds);

  const { error } = await supabaseAdmin.from('orders').delete().in('id', orderIds);
  if (error) throw error;
};

const forceDeleteProductOrderHistory = async (supabaseAdmin: any, productId: string) => {
  const { data: linkedOrderItems, error: orderItemsError } = await supabaseAdmin
    .from('order_items')
    .select('id, order_id')
    .eq('product_id', productId);

  if (orderItemsError) throw orderItemsError;

  const orderIds = Array.from(
    new Set(
      ((linkedOrderItems as any[]) || [])
        .map((row) => String((row as any)?.order_id || '').trim())
        .filter(Boolean)
    )
  );

  if (orderIds.length) {
    const { error: deleteOrderItemsError } = await supabaseAdmin
      .from('order_items')
      .delete()
      .eq('product_id', productId);

    if (deleteOrderItemsError) throw deleteOrderItemsError;
  }

  let orphanOrderIds: string[] = [];
  if (orderIds.length) {
    const { data: remainingItems, error: remainingItemsError } = await supabaseAdmin
      .from('order_items')
      .select('order_id')
      .in('order_id', orderIds);

    if (remainingItemsError) throw remainingItemsError;

    const remainingOrderIdSet = new Set(
      ((remainingItems as any[]) || [])
        .map((row) => String((row as any)?.order_id || '').trim())
        .filter(Boolean)
    );

    orphanOrderIds = orderIds.filter((orderId) => !remainingOrderIdSet.has(orderId));
    await forceDeleteOrders(supabaseAdmin, orphanOrderIds);
  }

  return {
    deletedOrderItemCount: Array.isArray(linkedOrderItems) ? linkedOrderItems.length : 0,
    deletedOrderCount: orphanOrderIds.length,
  };
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const authHeader = extractAuthHeader(event);
    if (!authHeader) return json(401, { error: 'Unauthorized' });

    const { user, error: authError } = await getAuthedUser(authHeader);
    if (!user) return json(401, { error: authError || 'Unauthorized' });

    const profileId = await resolveProfileId(user);
    if (!profileId) return json(400, { error: 'Missing profile id' });

    const productId = String(event.queryStringParameters?.id || '').trim();
    if (!productId) return json(400, { error: 'Missing product id' });

    const supabaseAdmin = createSupabaseAdmin();
    const ownedProfileIds = await resolveOwnedProfileIdsForUser({ supabaseAdmin, user });
    let isAdmin = false;
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id,user_id,role,primary_role')
        .or(`id.eq.${profileId},user_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle();

      const role = String((profile as any)?.primary_role || (profile as any)?.role || '').trim().toLowerCase();
      if (role === 'admin') {
        isAdmin = true;
      }
    } catch {
      // Fallback to user_roles and env allowlist below.
    }

    if (!isAdmin) {
      try {
        const { data: roles } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (Array.isArray(roles) && roles.some((entry: any) => String(entry?.role || '').trim().toLowerCase() === 'admin')) {
          isAdmin = true;
        }
      } catch {
        // Ignore user_roles lookup failures.
      }
    }

    if (!isAdmin) {
      const userEmail = String((user as any)?.email || '').trim().toLowerCase();
      const adminEmails = String(process.env.ADMIN_EMAILS || '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
      if (userEmail && adminEmails.includes(userEmail)) {
        isAdmin = true;
      }
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id,seller_id,title')
      .eq('id', productId)
      .maybeSingle();

    if (productError) return json(500, { error: productError.message });
    if (!product) return json(404, { error: 'Product not found' });

    const ownsProduct =
      ownedProfileIds.includes(String((product as any)?.seller_id || '').trim()) ||
      String((product as any)?.seller_id || '').trim() === profileId ||
      String((product as any)?.seller_id || '').trim() === String(user.id || '').trim();

    if (!isAdmin && !ownsProduct) {
      return json(403, { error: 'Forbidden' });
    }

    const guard = await checkOrderItemReferences({ supabaseAdmin, productId });
    let purgeSummary: { deletedOrderItemCount: number; deletedOrderCount: number } | null = null;

    await cleanupProductRelations(supabaseAdmin, productId);

    if (!guard.ok) {
      if (isAdmin) {
        purgeSummary = await forceDeleteProductOrderHistory(supabaseAdmin, productId);
      } else {
      const { error: archiveError } = await supabaseAdmin
        .from('products')
        .update({
          status: 'archived',
          is_active: false,
          is_promotable: false,
          in_stock: false,
        })
        .eq('id', productId);

      if (archiveError) return json(500, { error: archiveError.message });

      await writeAuditLog({
        supabaseAdmin,
        actor_user_id: user.id,
        action: 'ARCHIVE_PRODUCT_ON_DELETE_GUARD',
        entity_type: 'product',
        entity_id: productId,
        details: { reason: guard.reason || 'Order items exist', warning: guard.warning || null },
      });

      return json(200, {
        ok: true,
        archived: true,
        warning: guard.reason || 'Product has order history and was archived instead of deleted',
      });
      }
    }

    const { error } = await supabaseAdmin.from('products').delete().eq('id', productId);
    if (error) return json(500, { error: error.message });

    await writeAuditLog({
      supabaseAdmin,
        actor_user_id: user.id,
        action: purgeSummary ? 'FORCE_DELETE_PRODUCT' : 'DELETE_PRODUCT',
        entity_type: 'product',
        entity_id: productId,
        details: {
          ...(guard.warning ? { warning: guard.warning } : {}),
          ...(purgeSummary
            ? {
                deleted_order_items: purgeSummary.deletedOrderItemCount,
                deleted_orders: purgeSummary.deletedOrderCount,
              }
            : {}),
        },
      });

    return json(200, {
      ok: true,
      warning: guard.warning || null,
      forceDeleted: Boolean(purgeSummary),
      deletedOrderItems: purgeSummary?.deletedOrderItemCount || 0,
      deletedOrders: purgeSummary?.deletedOrderCount || 0,
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};
