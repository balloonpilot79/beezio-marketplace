import type { Handler } from '@netlify/functions';
import { json, assertPost, parseJson } from './_lib/http';
import { requireAdmin } from './_lib/auth';
import { createSupabaseAdmin } from './_lib/supabase';
import { getCJProductDetail } from './_lib/cj-api';

type VerifyBody = {
  cjProductId?: string;
  limit?: number;
};

type MappingRow = {
  id: string;
  beezio_product_id: string;
  cj_product_id: string | null;
  cj_product_sku: string | null;
  cj_variant_id: string | null;
  price_breakdown?: Record<string, any> | null;
  products?: {
    title?: string | null;
    seller_id?: string | null;
  } | null;
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const admin = await requireAdmin(event);
    const body = parseJson<VerifyBody>(event.body);
    const supabaseAdmin = createSupabaseAdmin();

    const requestedProductId = String(body?.cjProductId || '').trim();
    const limit = Math.min(Math.max(Number(body?.limit || 25) || 25, 1), 100);

    let query = supabaseAdmin
      .from('cj_product_mappings')
      .select('id,beezio_product_id,cj_product_id,cj_product_sku,cj_variant_id,price_breakdown,products!inner(title,seller_id)')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (requestedProductId) {
      query = query.eq('cj_product_id', requestedProductId);
    }

    const { data, error } = await query;
    if (error) return json(500, { error: error.message });

    const rows = (Array.isArray(data) ? data : []).filter((row: any) => {
      const sellerId = String(row?.products?.seller_id || '').trim();
      return sellerId === admin.profileId;
    }) as MappingRow[];

    const results = [];
    let verified = 0;
    let failed = 0;

    for (const row of rows) {
      const cjProductId = String(row?.cj_product_id || '').trim();
      const cjProductSku = String(row?.cj_product_sku || '').trim();
      const cjVariantId = String(row?.cj_variant_id || '').trim();
      const startedAt = new Date().toISOString();

      try {
        const detail = await getCJProductDetail({
          pid: cjProductId || undefined,
          productSku: !cjProductId && cjProductSku ? cjProductSku : undefined,
        });

        const detailPid = String(detail?.pid || '').trim();
        const detailProductSku = String(detail?.productSku || '').trim();
        const detailProductSpu = String(detail?.productSpu || '').trim();
        const variants = Array.isArray(detail?.variants) ? detail.variants : [];
        const matchedVariant = cjVariantId
          ? variants.find((variant: any) => String(variant?.vid || '').trim() === cjVariantId)
          : null;

        const verification = {
          verified: Boolean(detailPid),
          verified_at: startedAt,
          source: 'cj_api',
          matched_pid: detailPid || null,
          matched_product_sku: detailProductSku || null,
          matched_product_spu: detailProductSpu || null,
          matched_variant_id: matchedVariant ? String(matchedVariant?.vid || '').trim() : null,
          matched_variant_sku: matchedVariant ? String(matchedVariant?.variantSku || '').trim() : null,
          variant_found: cjVariantId ? Boolean(matchedVariant) : null,
          variants_count: variants.length,
          product_title: String(detail?.productNameEn || '').trim() || null,
        };

        const nextPriceBreakdown = {
          ...(row?.price_breakdown || {}),
          verification,
        };

        await supabaseAdmin
          .from('cj_product_mappings')
          .update({
            price_breakdown: nextPriceBreakdown,
            last_synced: new Date().toISOString(),
          })
          .eq('id', row.id);

        verified += 1;
        results.push({
          beezio_product_id: row.beezio_product_id,
          title: row?.products?.title || 'CJ product',
          cj_product_id: cjProductId || null,
          cj_product_sku: cjProductSku || null,
          cj_variant_id: cjVariantId || null,
          verification,
        });
      } catch (err: any) {
        failed += 1;
        const verification = {
          verified: false,
          verified_at: startedAt,
          source: 'cj_api',
          error: err?.message || 'Verification failed',
        };

        const nextPriceBreakdown = {
          ...(row?.price_breakdown || {}),
          verification,
        };

        await supabaseAdmin
          .from('cj_product_mappings')
          .update({
            price_breakdown: nextPriceBreakdown,
            last_synced: new Date().toISOString(),
          })
          .eq('id', row.id);

        results.push({
          beezio_product_id: row.beezio_product_id,
          title: row?.products?.title || 'CJ product',
          cj_product_id: cjProductId || null,
          cj_product_sku: cjProductSku || null,
          cj_variant_id: cjVariantId || null,
          verification,
        });
      }
    }

    return json(200, {
      ok: true,
      summary: {
        checked: results.length,
        verified,
        failed,
      },
      results,
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
