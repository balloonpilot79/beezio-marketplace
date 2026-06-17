import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, parseJson } from './_lib/http';

type RedeemBody = {
  entitlementId?: string;
};

const unauthorized = () => json(401, { error: 'Authentication required.' });

export const handler: Handler = async (event) => {
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    if (!authHeader.startsWith('Bearer ')) return unauthorized();

    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseAdmin = createSupabaseAdmin();
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const buyerUserId = String(authData?.user?.id || '').trim();
    if (authError || !buyerUserId) return unauthorized();

    if (event.httpMethod === 'GET') {
      const orderId = String(event.queryStringParameters?.orderId || '').trim();
      let query = supabaseAdmin
        .from('digital_download_entitlements')
        .select(`
          id,
          order_id,
          order_item_id,
          product_id,
          original_filename,
          content_type,
          file_size_bytes,
          download_limit,
          download_count,
          last_downloaded_at,
          access_status,
          created_at,
          metadata,
          products:product_id (
            title,
            digital_download_instructions,
            digital_return_policy_notice
          )
        `)
        .eq('buyer_user_id', buyerUserId)
        .order('created_at', { ascending: false });

      if (orderId) query = query.eq('order_id', orderId);

      const { data, error } = await query;
      if (error) return json(500, { error: error.message });

      const entitlements = ((data as any[]) || []).map((row) => ({
        id: String(row.id),
        orderId: String(row.order_id),
        orderItemId: String(row.order_item_id),
        productId: String(row.product_id),
        title: String(row?.products?.title || row.original_filename || 'Digital download'),
        filename: String(row.original_filename || 'download'),
        contentType: row.content_type || null,
        fileSizeBytes: row.file_size_bytes ?? null,
        downloadLimit: Number(row.download_limit || 1),
        downloadCount: Number(row.download_count || 0),
        remainingDownloads: Math.max(0, Number(row.download_limit || 1) - Number(row.download_count || 0)),
        status: String(row.access_status || 'active'),
        lastDownloadedAt: row.last_downloaded_at || null,
        instructions: String(row?.products?.digital_download_instructions || '').trim() || null,
        returnPolicyNotice: String(row?.products?.digital_return_policy_notice || '').trim() || null,
      }));

      return json(200, { ok: true, entitlements });
    }

    if (event.httpMethod !== 'POST') {
      return json(405, { error: 'Method not allowed' });
    }

    const body = parseJson<RedeemBody>(event.body);
    const entitlementId = String(body?.entitlementId || '').trim();
    if (!entitlementId) return json(400, { error: 'Missing entitlementId' });

    const { data: entitlement, error: entitlementError } = await supabaseAdmin
      .from('digital_download_entitlements')
      .select('id, buyer_user_id, storage_bucket, storage_path, original_filename, download_limit, download_count, access_status')
      .eq('id', entitlementId)
      .eq('buyer_user_id', buyerUserId)
      .maybeSingle();

    if (entitlementError) return json(500, { error: entitlementError.message });
    if (!entitlement) return json(404, { error: 'Download not found.' });

    const downloadLimit = Math.max(1, Number((entitlement as any).download_limit || 1));
    const downloadCount = Math.max(0, Number((entitlement as any).download_count || 0));
    if (String((entitlement as any).access_status || 'active') !== 'active') {
      return json(410, { error: 'This download is no longer available.' });
    }
    if (downloadCount >= downloadLimit) {
      return json(410, { error: 'This file has already been downloaded.' });
    }

    const bucket = String((entitlement as any).storage_bucket || '').trim();
    const path = String((entitlement as any).storage_path || '').trim();
    if (!bucket || !path) return json(500, { error: 'Download file is missing.' });

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, 120, {
        download: String((entitlement as any).original_filename || 'download'),
      });

    if (signedError || !signed?.signedUrl) {
      return json(500, { error: signedError?.message || 'Unable to create download link.' });
    }

    const nextCount = downloadCount + 1;
    const nextStatus = nextCount >= downloadLimit ? 'exhausted' : 'active';
    const { error: updateError } = await supabaseAdmin
      .from('digital_download_entitlements')
      .update({
        download_count: nextCount,
        access_status: nextStatus,
        last_downloaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', entitlementId)
      .eq('buyer_user_id', buyerUserId);

    if (updateError) return json(500, { error: updateError.message });

    return json(200, {
      ok: true,
      url: signed.signedUrl,
      filename: String((entitlement as any).original_filename || 'download'),
      remainingDownloads: Math.max(0, downloadLimit - nextCount),
    });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Unexpected error' });
  }
};

export default handler;
