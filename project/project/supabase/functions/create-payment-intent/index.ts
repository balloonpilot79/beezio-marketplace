import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CartItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  sellerId: string;
  sellerDesiredAmount?: number;
  commissionRate: number;
  affiliateId?: string;
  affiliateCommissionRate?: number;
  variantId?: string | null;
}

const roundToCents = (amount: number): number => Math.round((amount + Number.EPSILON) * 100);
const looksLikeUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

type CjInventoryResult = { ok: true; stock: number; backorder: boolean } | { ok: false; error: string };

const parseBoolish = (value: unknown): boolean => {
  if (value === true) return true;
  if (value === false) return false;
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return false;
  return ['1', 'true', 'yes', 'y', 'backorder', 'preorder'].includes(v);
};

const extractCjBackorderFlag = (payload: any): boolean => {
  // Best-effort: CJ response shapes vary.
  const candidates = [
    payload?.backorder,
    payload?.isBackorder,
    payload?.is_backorder,
    payload?.allowBackorder,
    payload?.preSale,
    payload?.isPresale,
    payload?.presale,
    payload?.stockStatus,
    payload?.status,
    payload?.data?.backorder,
    payload?.data?.isBackorder,
    payload?.data?.stockStatus,
  ];
  return candidates.some(parseBoolish);
};

const extractCjStockNumber = (payload: any): number => {
  const toNum = (n: unknown) => {
    const v = Number(n);
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
  };

  const directCandidates = [
    payload?.stock,
    payload?.variantStock,
    payload?.availableStock,
    payload?.inventory,
    payload?.inventoryNum,
    payload?.stockNum,
    payload?.quantity,
    payload?.data?.stock,
    payload?.data?.inventory,
    payload?.data?.availableStock,
  ];
  for (const c of directCandidates) {
    const parsed = toNum(c);
    if (parsed !== null) return parsed;
  }

  const list =
    (Array.isArray(payload?.list) && payload.list) ||
    (Array.isArray(payload?.content) && payload.content) ||
    (Array.isArray(payload?.inventoryList) && payload.inventoryList) ||
    (Array.isArray(payload?.data?.list) && payload.data.list) ||
    (Array.isArray(payload?.data?.content) && payload.data.content) ||
    [];
  if (Array.isArray(list) && list.length) {
    const sum = list.reduce((acc: number, row: any) => {
      const parsed =
        toNum(row?.stock) ??
        toNum(row?.availableStock) ??
        toNum(row?.inventory) ??
        toNum(row?.inventoryNum) ??
        toNum(row?.stockNum) ??
        0;
      return acc + parsed;
    }, 0);
    return Math.floor(sum);
  }

  return 0;
};

const checkCjInventoryViaProxy = async (params: { pid: string; vid?: string | null }): Promise<CjInventoryResult> => {
  const base = String(Deno.env.get('NETLIFY_FUNCTIONS_URL') || '').trim().replace(/\/$/, '');
  // Fallback to production domain if not set (matches other server-side calls in this repo).
  const url = `${base || 'https://beezio.co'}/.netlify/functions/cj-proxy`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'product/inventory/query',
        method: 'POST',
        body: { pid: params.pid, ...(params.vid ? { vid: params.vid } : {}) },
      }),
    });
    const raw = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
    if (!res.ok || !json?.result) {
      return { ok: false, error: json?.message || json?.error || `CJ inventory proxy error (${res.status})` };
    }

    const payload = json?.data ?? json;
    const stock = extractCjStockNumber(payload);
    const backorder = extractCjBackorderFlag(payload);
    return { ok: true, stock, backorder };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { 
      amount, 
      items, 
      userId, 
      billingName, 
      billingEmail,
      tax,
      shippingAmount,
      shippingOptionName,
      shippingMethodCode,
      shippingCountry,
    } = await req.json()

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
      Deno.env.get('SERVICE_ROLE_KEY') ??
      ''

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    )

    // Inventory guard (prevents charging for out-of-stock items)
    const itemsArray = Array.isArray(items) ? (items as CartItem[]) : [];
    const requestedProductQty = new Map<string, number>();
    const requestedVariantQty = new Map<string, number>();

    for (const item of itemsArray) {
      const qty = Number.isFinite(item?.quantity) ? Number(item.quantity) : 0;
      if (qty <= 0) continue;
      const variantId = typeof item?.variantId === 'string' ? item.variantId : null;

      if (variantId && looksLikeUuid(variantId)) {
        requestedVariantQty.set(variantId, (requestedVariantQty.get(variantId) ?? 0) + qty);
      } else if (typeof item?.productId === 'string' && looksLikeUuid(item.productId)) {
        requestedProductQty.set(item.productId, (requestedProductQty.get(item.productId) ?? 0) + qty);
      }
    }

    if (requestedProductQty.size || requestedVariantQty.size) {
      const productIds = Array.from(requestedProductQty.keys());
      const variantIds = Array.from(requestedVariantQty.keys());

      const productStockById = new Map<string, number>();
      const variantStockById = new Map<string, number>();
      const productProviderById = new Map<string, string>();
      const variantCjById = new Map<string, { cj_product_id?: string | null; cj_variant_id?: string | null }>();

      if (productIds.length) {
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, stock_quantity, dropship_provider, lineage')
          .in('id', productIds);

        if (productsError) {
          throw new Error(`Inventory check failed: ${productsError.message}`);
        }

        for (const row of (products as any[]) || []) {
          productStockById.set(row.id, Number.isFinite(row.stock_quantity) ? Number(row.stock_quantity) : 0);
          const provider =
            String(row?.dropship_provider || '').trim().toLowerCase() ||
            (String(row?.lineage || '').trim().toLowerCase() === 'cj' ? 'cj' : '');
          productProviderById.set(row.id, provider);
        }
      }

      if (variantIds.length) {
        const { data: variants, error: variantsError } = await supabase
          .from('product_variants')
          .select('id, inventory, provider, cj_product_id, cj_variant_id')
          .in('id', variantIds);

        if (variantsError) {
          throw new Error(`Inventory check failed: ${variantsError.message}`);
        }

        for (const row of (variants as any[]) || []) {
          variantStockById.set(row.id, Number.isFinite(row.inventory) ? Number(row.inventory) : 0);
          variantCjById.set(String(row.id), {
            cj_product_id: row?.cj_product_id ?? null,
            cj_variant_id: row?.cj_variant_id ?? null,
          });
        }
      }

      // CJ live inventory validation (blocks zero/backorder at time of sale)
      // Uses CJ proxy so we never expose CJ credentials.
      const cjMappedByProductId = new Map<string, { cj_product_id: string; cj_variant_id?: string | null }>();
      const cjProductsNeedingFallback = productIds.filter((id) => productProviderById.get(id) === 'cj');
      if (cjProductsNeedingFallback.length) {
        const { data: mappings } = await supabase
          .from('cj_product_mappings')
          .select('beezio_product_id, cj_product_id, cj_variant_id')
          .in('beezio_product_id', cjProductsNeedingFallback);

        for (const m of (mappings as any[]) || []) {
          if (!m?.beezio_product_id || !m?.cj_product_id) continue;
          cjMappedByProductId.set(String(m.beezio_product_id), {
            cj_product_id: String(m.cj_product_id),
            cj_variant_id: m?.cj_variant_id ? String(m.cj_variant_id) : null,
          });
        }
      }

      for (const item of itemsArray) {
        const qty = Number.isFinite(item?.quantity) ? Number(item.quantity) : 0;
        if (qty <= 0) continue;
        const productId = typeof item?.productId === 'string' ? item.productId : '';
        if (!productId || !looksLikeUuid(productId)) continue;

        const isCj = productProviderById.get(productId) === 'cj';
        if (!isCj) continue;

        const variantId = typeof item?.variantId === 'string' ? item.variantId : null;
        const cjFromVariant =
          variantId && looksLikeUuid(variantId)
            ? variantCjById.get(variantId) || null
            : null;
        const fallback = cjMappedByProductId.get(productId) || null;

        const pid = String(cjFromVariant?.cj_product_id || fallback?.cj_product_id || '').trim();
        const vidRaw = String(cjFromVariant?.cj_variant_id || fallback?.cj_variant_id || '').trim();
        const vid = vidRaw ? vidRaw : null;

        if (!pid) {
          return new Response(JSON.stringify({ error: `CJ mapping missing for product ${productId}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        const inv = await checkCjInventoryViaProxy({ pid, vid });
        if (!inv.ok) {
          return new Response(JSON.stringify({ error: `CJ inventory check failed`, details: inv.error, productId, variantId }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 502,
          });
        }
        if (inv.backorder || inv.stock <= 0 || qty > inv.stock) {
          return new Response(JSON.stringify({
            error: 'Out of stock',
            code: 'OUT_OF_STOCK',
            provider: 'CJ',
            productId,
            variantId,
            requested: qty,
            available: inv.stock,
            backorder: inv.backorder,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 409,
          });
        }
      }

      for (const [productId, qty] of requestedProductQty.entries()) {
        const available = productStockById.get(productId);
        if (typeof available !== 'number') {
          return new Response(JSON.stringify({ error: `Product not found for inventory check: ${productId}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          });
        }
        if (qty > available) {
          return new Response(JSON.stringify({
            error: `Insufficient inventory for product ${productId}. Requested ${qty}, available ${available}.`,
            code: 'OUT_OF_STOCK',
            productId,
            requested: qty,
            available,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 409,
          });
        }
      }

      for (const [variantId, qty] of requestedVariantQty.entries()) {
        const available = variantStockById.get(variantId);
        if (typeof available !== 'number') {
          return new Response(JSON.stringify({ error: `Variant not found for inventory check: ${variantId}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          });
        }
        if (qty > available) {
          return new Response(JSON.stringify({
            error: `Insufficient inventory for variant ${variantId}. Requested ${qty}, available ${available}.`,
            code: 'OUT_OF_STOCK',
            variantId,
            requested: qty,
            available,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 409,
          });
        }
      }
    }

    // Calculate totals for the first item (for metadata)
    const primaryItem = itemsArray[0] as CartItem
    const totalAmount = amount / 100 // Convert back from cents

    // Create comprehensive metadata for payment distribution
    const metadata = {
      userId: userId || '',
      billingName: billingName || '',
      billingEmail: billingEmail || '',
      itemCount: itemsArray.length.toString(),
      totalAmount: totalAmount.toString(),
      taxAmount: typeof tax === 'number' ? tax.toString() : '',
      shippingAmount: typeof shippingAmount === 'number' ? shippingAmount.toString() : '',
      shippingOptionName: shippingOptionName || '',
      shippingMethodCode: shippingMethodCode || '',
      shippingCountry: shippingCountry || '',
      // Primary item metadata (for simple cases)
      productId: primaryItem?.productId || '',
      sellerId: primaryItem?.sellerId || '',
      commissionRate: (primaryItem?.commissionRate || 70).toString(),
      affiliateId: primaryItem?.affiliateId || '',
      affiliateCommissionRate: (primaryItem?.affiliateCommissionRate || 0).toString(),
      // Additional metadata as JSON string for complex cases
      allItems: JSON.stringify(itemsArray)
    }

    // IMPORTANT:
    // We keep all charges on the platform account and rely on our webhook + `payment_distributions`
    // + payout automation to split funds between sellers/affiliates.
    //
    // Using destination charges here would send the seller their funds immediately, but we'd *also*
    // record pending seller distributions in the webhook, leading to double payouts later.
    const piParams: any = {
      amount,
      currency: 'usd',
      metadata,
      description: `Order from ${billingName || 'Customer'} - ${itemsArray.length} item(s)`,
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create(piParams)

    // Create order record in database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        id: paymentIntent.id, // Use payment intent ID as order ID
        user_id: userId,
        total_amount: totalAmount,
        currency: 'USD',
        status: 'pending',
        payment_status: 'pending',
        stripe_payment_intent_id: paymentIntent.id,
        billing_name: billingName,
        billing_email: billingEmail,
        order_items: items
      })
      .select()
      .single()

    if (orderError) {
      console.error('Error creating order:', orderError)
      // Continue anyway, order will be created by webhook
    }

    return new Response(JSON.stringify({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      // In our schema we use the PaymentIntent id as the order id
      order_id: paymentIntent.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Payment intent creation error:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
