import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost } from './_lib/http';
import { extractAuthHeader, getAuthedUser, resolveProfileId } from './_lib/auth';
import { writeAuditLog } from './_lib/audit';
import { recomputeProductStock } from './_lib/cj-stock';
import { resolveOwnedProfileIdsForUser } from './_lib/owned-profiles';

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const authHeader = extractAuthHeader(event);
    if (!authHeader) return json(401, { error: 'Unauthorized' });

    const { user, error: authError } = await getAuthedUser(authHeader);
    if (!user) return json(401, { error: authError || 'Unauthorized' });

    const productId = String(event.queryStringParameters?.id || '').trim();
    if (!productId) return json(400, { error: 'Missing product id' });

    const supabaseAdmin = createSupabaseAdmin();
    const profileId = (await resolveProfileId(user as any)) || String((user as any)?.id || '').trim();
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
      // Fall back to user_roles and env allowlist below.
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
      .select('id,seller_id,title,status')
      .eq('id', productId)
      .maybeSingle();

    if (productError) return json(500, { error: productError.message });
    if (!product) return json(404, { error: 'Product not found' });

    const sellerId = String((product as any)?.seller_id || '').trim();
    const ownsProduct =
      ownedProfileIds.includes(sellerId) ||
      sellerId === profileId ||
      sellerId === String((user as any)?.id || '').trim();

    if (!isAdmin && !ownsProduct) {
      return json(403, { error: 'Forbidden' });
    }

    const { error } = await supabaseAdmin
      .from('products')
      .update({ status: 'archived', is_active: false, is_promotable: false, in_stock: false })
      .eq('id', productId);
    if (error) return json(500, { error: error.message });

    await recomputeProductStock({ supabaseAdmin, productId, status: 'archived' });
    await writeAuditLog({
      supabaseAdmin,
      actor_user_id: user.id,
      action: 'ARCHIVE_PRODUCT',
      entity_type: 'product',
      entity_id: productId,
      details: {
        seller_id: sellerId || null,
        previous_status: String((product as any)?.status || '').trim() || null,
        archived_by: isAdmin ? 'admin' : 'owner',
      },
    });

    return json(200, { ok: true });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};
