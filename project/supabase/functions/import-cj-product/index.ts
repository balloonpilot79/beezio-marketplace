import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ImportRequest = {
  cjProduct: {
    pid: string
    productNameEn: string
    productSku: string
    productImage: string
    categoryName: string
    sellPrice: number
  }
  detailedProduct?: {
    description?: string
    productImageList?: string[]
  } | null
  pricing: {
    markup: number
    affiliateCommission: number
  }
  beezioCategory: string
  categoryId: string | null
  computed: {
    finalPrice: number
    sellerAsk: number
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
      Deno.env.get('SERVICE_ROLE_KEY') ??
      ''

    if (!supabaseUrl) return json(500, { error: 'Missing SUPABASE_URL' })
    if (!serviceRoleKey) return json(500, { error: 'Missing SERVICE_ROLE_KEY' })

    // Authenticated user client (to validate the caller)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'Missing Authorization header' })

    const supabaseAuthed = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userError } = await supabaseAuthed.auth.getUser()
    if (userError || !userData?.user) {
      return json(401, { error: 'Unauthorized', details: userError?.message })
    }

    const user = userData.user
    const email = (user.email || '').toLowerCase()

    const body = (await req.json()) as ImportRequest

    // Admin-only by email fallback (matches UI gate); also allow DB role=admin.
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, role, primary_role')
      .eq('user_id', user.id)
      .maybeSingle()

    const callerRole = (callerProfile?.primary_role || callerProfile?.role || '').toLowerCase()
    const isAllowed =
      email === 'jason@beezio.co' ||
      email === 'jasonlovingsr@gmail.com' ||
      callerRole === 'admin'

    if (!isAllowed) {
      return json(403, { error: 'Forbidden' })
    }

    // Ensure profile exists for FK constraints.
    const defaultRole = email === 'jason@beezio.co' || email === 'jasonlovingsr@gmail.com' ? 'admin' : 'buyer'
    await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: user.id,
          user_id: user.id,
          email: user.email,
          full_name: (user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || '',
          role: defaultRole,
          primary_role: defaultRole,
        },
        { onConflict: 'id' }
      )

    const cjProduct = body?.cjProduct
    if (!cjProduct?.pid || !cjProduct?.productNameEn) {
      return json(400, { error: 'Missing cjProduct' })
    }

    const finalPrice = Number(body?.computed?.finalPrice)
    const sellerAsk = Number(body?.computed?.sellerAsk)
    if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
      return json(400, { error: 'Invalid computed.finalPrice' })
    }
    if (!Number.isFinite(sellerAsk) || sellerAsk <= 0) {
      return json(400, { error: 'Invalid computed.sellerAsk' })
    }

    const pricing = body?.pricing || { markup: 115, affiliateCommission: 30 }
    const detailed = body?.detailedProduct || null

    const insertPayload: any = {
      seller_id: user.id,
      title: cjProduct.productNameEn,
      description:
        detailed?.description ||
        `${cjProduct.productNameEn} - Imported from CJ Dropshipping. Earn ${pricing.affiliateCommission}% commission!`,
      seller_ask: sellerAsk,
      seller_amount: sellerAsk,
      seller_ask_price: sellerAsk,
      price: finalPrice,
      category: body?.beezioCategory || cjProduct.categoryName || 'Other',
      category_id: body?.categoryId || null,
      image_url: cjProduct.productImage,
      images: detailed?.productImageList?.length ? detailed.productImageList : [cjProduct.productImage],
      sku: cjProduct.productSku,
      stock_quantity: 9999,
      is_digital: false,
      requires_shipping: true,
      shipping_cost: 0,
      affiliate_enabled: true,
      commission_rate: pricing.affiliateCommission,
      commission_type: 'percentage',
      flat_commission_amount: 0,
      affiliate_commission_rate: pricing.affiliateCommission,
      product_type: 'one_time',
      dropship_provider: 'cj',
      lineage: 'CJ',
      is_promotable: true,
      is_active: true,
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .insert(insertPayload)
      .select()
      .single()

    if (productError) {
      return json(400, {
        error: 'Failed to insert product',
        details: productError.message,
        code: productError.code,
        hint: (productError as any).hint,
      })
    }

    const { error: mappingError } = await supabaseAdmin
      .from('cj_product_mappings')
      .insert({
        beezio_product_id: product.id,
        cj_product_id: cjProduct.pid,
        cj_product_sku: cjProduct.productSku,
        cj_cost: cjProduct.sellPrice,
        markup_percent: pricing.markup,
        affiliate_commission_percent: pricing.affiliateCommission,
        price_breakdown: {
          finalPrice,
          sellerAsk,
        },
        last_synced: new Date().toISOString(),
      })

    if (mappingError) {
      // Non-fatal: product exists, mapping can be repaired.
      console.error('CJ mapping insert failed:', mappingError)
    }

    return json(200, { product, mappingCreated: !mappingError })
  } catch (e) {
    console.error('import-cj-product error:', e)
    return json(500, { error: 'Unexpected error', details: String((e as any)?.message || e) })
  }
})
