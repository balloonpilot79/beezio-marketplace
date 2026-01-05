import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ImportVariant = {
  vid: string
  variantSku?: string
  variantNameEn?: string
  variantImage?: string
  variantSellPrice?: number
  variantStock?: number
  variantKey?: string
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
  selectedVariant?: {
    vid: string
    variantSku?: string
    variantNameEn?: string
    variantImage?: string
    variantSellPrice?: number
  } | null
  variants?: any[]
  inventory?: number | null
  pricing: {
    markup: number
    affiliateCommission: number
  }
  shippingCost?: number
  beezioCategory: string
  categoryId: string | null
  computed: {
    finalPrice: number
    sellerAsk: number
  }
}

const decodeEntities = (input: string): string => {
  const raw = String(input || '')
  if (!raw) return ''
  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code)
      return Number.isFinite(n) ? String.fromCharCode(n) : ''
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const n = parseInt(hex, 16)
      return Number.isFinite(n) ? String.fromCharCode(n) : ''
    })
}

const stripHtmlToText = (input: string): string => {
  let raw = String(input || '')
  if (!raw) return ''

  // Decode first so encoded tags like &lt;p&gt; are removed correctly.
  raw = decodeEntities(raw)

  // Strip tags, then decode again and strip once more for double-encoded content.
  raw = raw
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  raw = decodeEntities(raw)
  raw = raw
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  return raw.replace(/\s+/g, ' ').trim()
}

const sanitizeImportedDescription = (raw: string): string => {
  const text = stripHtmlToText(raw)
  if (!text) return ''
  // Remove URLs (CJ links and any other pasted URLs)
  const withoutUrls = text
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\bwww\.[^\s]+/gi, ' ')

  return withoutUrls
    .replace(/cj\s*dropshipping/gi, '')
    .replace(/cjdropshipping/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const looksLikeUuid = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  return UUID_REGEX.test(trimmed)
}

const parseCJPriceToUSD = (value: unknown): number => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return 0
    if (Number.isInteger(value) && value >= 1000 && value <= 1000000) {
      return roundToTwo(value / 100)
    }
    return roundToTwo(value)
  }

  const raw = String(value ?? '').trim()
  if (!raw) return 0

  const firstPart = raw.split('--')[0]?.trim() ?? raw
  const match = firstPart.match(/-?\d+(?:\.\d+)?/)
  if (!match) return 0

  const parsed = Number(match[0])
  if (!Number.isFinite(parsed) || parsed <= 0) return 0

  const hadDecimal = match[0].includes('.')
  if (!hadDecimal && Number.isInteger(parsed) && parsed >= 1000 && parsed <= 1000000) {
    return roundToTwo(parsed / 100)
  }

  return roundToTwo(parsed)
}

const extractImageUrls = (value: unknown): string[] => {
  if (!value) return []
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean)
  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return []
    if (raw.includes(',')) return raw.split(',').map((v) => v.trim()).filter(Boolean)
    return [raw]
  }
  if (typeof value === 'object') {
    const url = (value as any)?.url ?? (value as any)?.image ?? (value as any)?.src
    return url ? [String(url).trim()].filter(Boolean) : []
  }
  return []
}

const uniqueStrings = (values: unknown[]): string[] => {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of values || []) {
    const s = String(v ?? '').trim()
    if (!s) continue
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

const ATTRIBUTE_PART_SPLIT = /[|,;\/]+/

const parseVariantAttributes = (variant: ImportVariant): Record<string, string> => {
  const attributes: Record<string, string> = {}
  const looseFragments: string[] = []

  const hydrate = (source?: string) => {
    if (!source) return
    const cleaned = source.replace(/[\r\n]+/g, ' ').trim()
    const parts = cleaned
      .split(ATTRIBUTE_PART_SPLIT)
      .map(part => part.trim())
      .filter(Boolean)

    parts.forEach(part => {
      const separatorIndex = part.search(/[:=]/)
      if (separatorIndex >= 0) {
        const key = part.slice(0, separatorIndex).trim()
        const value = part.slice(separatorIndex + 1).trim()
        if (key && value) {
          attributes[key] = value
          return
        }
      }
      looseFragments.push(part)
    })
  }

  hydrate(variant.variantKey)
  hydrate(variant.variantNameEn)

  if (looseFragments.length > 0) {
    looseFragments.forEach((fragment, index) => {
      const fallbackKey = `Variant Option ${index + 1}`
      if (!attributes[fallbackKey]) {
        attributes[fallbackKey] = fragment
      }
    })
  }

  if (Object.keys(attributes).length === 0 && variant.variantNameEn) {
    attributes['Variant'] = variant.variantNameEn
  }

  return attributes
}

const upsertProductVariants = async (
  client: any,
  productId: string,
  variants: ImportVariant[],
  fallbackImage: string | null,
  fallbackInventory: number | null,
  basePrice: number,
  cjProductId: string,
  productSku: string
) => {
  const normalizedRows = variants
    .map(variant => {
      if (!variant?.vid) return null
      // Normalize all possible fields
      const price = parseCJPriceToUSD(variant.variantSellPrice ?? basePrice)
      const sku = (variant.variantSku || '').trim() || `${productSku}-${variant.vid}`
      const inventoryCandidate =
        variant.variantStock ??
        (variant as any)?.stock ??
        (variant as any)?.inventory ??
        (variant as any)?.inventoryNum ??
        (variant as any)?.variantInventoryNum ??
        NaN
      const inventoryNumber = Number(inventoryCandidate)
      const inventory = Number.isFinite(inventoryNumber) && inventoryNumber >= 0 ? inventoryNumber : null
      // Collect all known and unknown fields
      const extraFields: Record<string, any> = {}
      for (const key in variant) {
        if (!['vid','variantSku','variantNameEn','variantImage','variantSellPrice','variantStock','variantKey'].includes(key)) {
          extraFields[key] = variant[key]
        }
      }
      return {
        product_id: productId,
        provider: 'CJ',
        cj_product_id: cjProductId,
        cj_variant_id: variant.vid,
        sku,
        price: price > 0 ? price : basePrice,
        compare_at_price: null,
        currency: 'USD',
        image_url:
          variant.variantImage ||
          (variant as any)?.variantBigImage ||
          (variant as any)?.variantImageUrl ||
          (variant as any)?.image ||
          (variant as any)?.bigImage ||
          fallbackImage ||
          null,
        attributes: parseVariantAttributes(variant),
        inventory,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...extraFields
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  if (!normalizedRows.length) {
    return
  }

  const { error } = await client
    .from('product_variants')
    .upsert(normalizedRows as any[], { onConflict: 'cj_variant_id' })

  if (error) {
    console.error('Failed to upsert product_variants', error)
      // Additional logging for troubleshooting
      try {
        await client.from('variant_upsert_errors').insert({
          error_message: String(error?.message || error),
          product_id: productId,
          cj_product_id: cjProductId,
          timestamp: new Date().toISOString(),
          payload: JSON.stringify(normalizedRows)
        })
      } catch (logErr) {
        console.error('Failed to log variant upsert error', logErr)
      }
  }
}

const upsertDefaultShippingOption = async (
  client: any,
  productId: string,
  shippingCost: number
) => {
  const normalizedCost = Number.isFinite(shippingCost) ? shippingCost : 0
  const now = new Date().toISOString()
  const payload = {
    product_id: productId,
    variant_id: null,
    provider: 'CJ',
    destination_country: 'US',
    method_code: 'CJ_DEFAULT',
    method_name: 'CJ shipping (quote at checkout)',
    cost: normalizedCost,
    min_days: null,
    max_days: null,
    processing_days: null,
    last_quoted_at: now,
    created_at: now,
    updated_at: now,
  }

  const { error } = await client
    .from('shipping_options')
    .upsert([payload] as any[], { onConflict: 'product_id,destination_country,method_code' })

  if (error) {
    console.error('Failed to upsert default shipping option', error)
  }
}

const PLATFORM_FEE_PERCENT = 15
const PLATFORM_FEE_UNDER_20_SURCHARGE = 1
const PLATFORM_FEE_UNDER_20_THRESHOLD = 20
const STRIPE_PERCENT = 2.9
const STRIPE_FIXED_FEE = 0.3

const platformFixedSurcharge = (askPrice: number): number =>
  Number.isFinite(askPrice) && askPrice > 0 && askPrice <= PLATFORM_FEE_UNDER_20_THRESHOLD
    ? PLATFORM_FEE_UNDER_20_SURCHARGE
    : 0

const calculateFinalPriceFromAsk = (askPrice: number, affiliatePercent: number): number => {
  const pAff = (Number.isFinite(affiliatePercent) ? affiliatePercent : 0) / 100
  const pPlatform = PLATFORM_FEE_PERCENT / 100
  const pStripe = STRIPE_PERCENT / 100
  const denom = 1 - pStripe
  if (denom <= 0) return 0

  const fixed = platformFixedSurcharge(askPrice)
  const targetNetAfterStripe = askPrice + askPrice * pAff + askPrice * pPlatform + fixed
  return roundToTwo((targetNetAfterStripe + STRIPE_FIXED_FEE) / denom)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
      Deno.env.get('SERVICE_ROLE_KEY') ??
      ''

    if (!supabaseUrl) return json(500, { error: 'Missing SUPABASE_URL' })
    if (!serviceRoleKey && !anonKey) {
      return json(500, { error: 'Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY for RLS mode)' })
    }

    // Authenticated user client (to validate the caller)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'Missing Authorization header' })

    const usingServiceRole = Boolean(serviceRoleKey)

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
    // Prefer service_role for inserts (bypasses RLS). If missing, fall back to anon+JWT (RLS enforced).
    const supabaseAdmin = usingServiceRole
      ? createClient(supabaseUrl, serviceRoleKey)
      : createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })

    const getColumnType = async (tableName: string, columnName: string): Promise<string | null> => {
      try {
        const { data, error } = await supabaseAdmin
          .from('information_schema.columns')
          .select('data_type')
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .eq('column_name', columnName)
          .limit(1)
          .maybeSingle()
        if (error || !data) return null
        return String((data as any).data_type || '').trim() || null
      } catch {
        return null
      }
    }

    const hasColumn = async (tableName: string, columnName: string): Promise<boolean> =>
      Boolean(await getColumnType(tableName, columnName))

    const isUuidColumn = (dataType: string | null): boolean => String(dataType || '').toLowerCase() === 'uuid'

    const emailWhitelisted = email === 'jason@beezio.co' || email === 'jasonlovingsr@gmail.com'
    let isAllowed = emailWhitelisted
    if (!isAllowed) {
      try {
        const { data: callerProfile } = await supabaseAdmin
          .from('profiles')
          .select('role, primary_role')
          .eq('user_id', user.id)
          .maybeSingle()
        const callerRole = (callerProfile?.primary_role || callerProfile?.role || '').toLowerCase()
        isAllowed = callerRole === 'admin'
      } catch {
        isAllowed = false
      }
    }

    if (!isAllowed) {
      return json(403, { error: 'Forbidden' })
    }

    // Resolve the caller profile id for FK constraints (products.seller_id -> profiles.id)
    const defaultRole = email === 'jason@beezio.co' || email === 'jasonlovingsr@gmail.com' ? 'admin' : 'buyer'
    let sellerProfileId: string | null = null
    try {
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      sellerProfileId = (existingProfile as any)?.id ?? null
    } catch {
      sellerProfileId = null
    }

    if (!sellerProfileId) {
      // Best-effort create a minimal profile for this user.
      const { data: createdProfile, error: createProfileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: user.id,
          email: user.email,
          full_name: (user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || '',
          role: defaultRole,
          primary_role: defaultRole,
        })
        .select('id')
        .single()

      if (createProfileError) {
        return json(400, {
          error: 'Failed to ensure seller profile',
          details: createProfileError.message,
          code: createProfileError.code,
          hint: (createProfileError as any).hint,
        })
      }

      sellerProfileId = (createdProfile as any)?.id ?? null
    }

    if (!sellerProfileId) {
      return json(400, { error: 'Could not resolve seller profile id (profiles.id)' })
    }

    const cjProduct = body?.cjProduct
    if (!cjProduct?.pid || !cjProduct?.productNameEn) {
      return json(400, { error: 'Missing cjProduct' })
    }

    const pricing = body?.pricing || { markup: 115, affiliateCommission: 30 }
    const detailed = body?.detailedProduct || null
    const selectedVariant = body?.selectedVariant || null
    const variants = (body?.variants ?? []) as ImportVariant[]
    const inventory = body?.inventory
    const numericInventory = inventory !== null && inventory !== undefined ? Number(inventory) : NaN
    const resolvedInventory = Number.isFinite(numericInventory) && numericInventory >= 0 ? numericInventory : null

    // If variant stocks are provided, prefer a product-level stock count equal to the sum of variant inventories.
    // This keeps products.stock_quantity meaningful when variant selection isn't used.
    const variantInventorySum = Array.isArray(variants)
      ? (variants as ImportVariant[]).reduce((acc, variant) => {
          const candidate = Number(variant?.variantStock);
          if (!Number.isFinite(candidate) || candidate < 0) return acc;
          return acc + candidate;
        }, 0)
      : null;

    const productStockQuantity =
      typeof variantInventorySum === 'number' && Number.isFinite(variantInventorySum)
        ? variantInventorySum
        : (resolvedInventory ?? 0);
    const shippingCostInput = Number(body?.shippingCost ?? 0);
    const shippingCost = Number.isFinite(shippingCostInput) && shippingCostInput >= 0 ? shippingCostInput : 0;
    const beezioCategory = String(body?.beezioCategory || '').trim() || null

    // Compute pricing server-side to avoid client/UI drift.
    const variantCostCandidate = selectedVariant && Object.prototype.hasOwnProperty.call(selectedVariant, 'variantSellPrice')
      ? (selectedVariant as any).variantSellPrice
      : undefined
    const cjCost = parseCJPriceToUSD(variantCostCandidate ?? (cjProduct as any).sellPrice)
    const markup = Number(pricing?.markup ?? 0)
    const affiliatePercent = Number(pricing?.affiliateCommission ?? 0)
    const safeCjCost = Number.isFinite(cjCost) && cjCost > 0 ? cjCost : 0
    const safeMarkup = Number.isFinite(markup) && markup >= 0 ? markup : 0
    const safeAffiliatePercent = Number.isFinite(affiliatePercent) && affiliatePercent >= 0 ? affiliatePercent : 0

    const sellerAsk = roundToTwo(safeCjCost + safeCjCost * (safeMarkup / 100))
    const finalPrice = calculateFinalPriceFromAsk(sellerAsk, safeAffiliatePercent)

    if (!Number.isFinite(finalPrice) || finalPrice <= 0 || !Number.isFinite(sellerAsk) || sellerAsk <= 0) {
      return json(400, {
        error: 'Invalid pricing inputs',
        details: { cjCost: (cjProduct as any).sellPrice, normalizedCjCost: cjCost, markup: pricing?.markup, affiliateCommission: pricing?.affiliateCommission },
      })
    }

    const normalizedImages = (() => {
      const raw = (detailed as any)?.productImageList
      let list: string[] = []
      if (Array.isArray(raw)) {
        list = raw
          .map((v: any) => {
            if (typeof v === 'string') return v
            if (v && typeof v === 'object') {
              return v.url || v.image || v.productImage || v.bigImage || v.variantImage || ''
            }
            return ''
          })
          .filter(Boolean)
      } else if (typeof raw === 'string') {
        // Some CJ responses return a comma-separated string.
        list = raw.split(',')
      }

      const cleaned = list
        .map((v) => String(v || '').trim())
        .filter(Boolean)

      const unique: string[] = []
      for (const url of cleaned) {
        if (!unique.includes(url)) unique.push(url)
      }

      if (!unique.length && cjProduct.productImage) unique.push(cjProduct.productImage)

      // Always merge in variant images so color options have distinct photos.
      const variantImageUrls = (Array.isArray(variants) ? variants : []).flatMap((v: any) => {
        const single = String(
          v?.variantImage ??
            v?.variantBigImage ??
            v?.variantImageUrl ??
            v?.image ??
            v?.bigImage ??
            v?.variantImg ??
            ''
        ).trim()
        return [
          ...extractImageUrls(v?.variantImageList),
          ...extractImageUrls(v?.imageList),
          ...extractImageUrls(v?.images),
          ...(single ? [single] : []),
        ]
      })

      return uniqueStrings([...unique, ...variantImageUrls]).slice(0, 10)
    })()

    // Resolve category id server-side (do not rely on client DB calls)
    const rawCategoryId = typeof body?.categoryId === 'string' ? body.categoryId.trim() : null

    const categoriesIdType = await getColumnType('categories', 'id')
    const categoriesUsesUuidId = isUuidColumn(categoriesIdType)
    const categoriesHasSlug = await hasColumn('categories', 'slug')

    let categoryId: string | null =
      rawCategoryId && categoriesUsesUuidId && looksLikeUuid(rawCategoryId) ? rawCategoryId : null

    try {
      const candidateSlug = rawCategoryId && !looksLikeUuid(rawCategoryId) ? rawCategoryId : null
      const candidateName = String(beezioCategory || '').trim()

      if (!categoryId) {
        if (!categoriesUsesUuidId && rawCategoryId) {
          // Text-backed category ids: accept the client-provided id directly (usually a slug).
          categoryId = rawCategoryId
        }
      }

      if (!categoryId && categoriesHasSlug && candidateSlug) {
        const { data: bySlug, error: bySlugError } = await supabaseAdmin
          .from('categories')
          .select('id')
          .eq('slug', candidateSlug)
          .limit(1)
          .maybeSingle()
        if (!bySlugError) {
          const found = (bySlug as any)?.id ?? null
          if (found) {
            categoryId = categoriesUsesUuidId ? (looksLikeUuid(found) ? found : null) : String(found)
          }
        }
      }

      // Always try name match (handles UUID-backed categories without slug column).
      if (!categoryId && candidateName) {
        const { data: byName } = await supabaseAdmin
          .from('categories')
          .select('id')
          .ilike('name', candidateName)
          .limit(1)
          .maybeSingle()
        const found = (byName as any)?.id ?? null
        if (found) {
          categoryId = categoriesUsesUuidId ? (looksLikeUuid(found) ? found : null) : String(found)
        }
      }

      // Last resort: if the UI sent a key that is actually a category name.
      if (!categoryId && rawCategoryId && !looksLikeUuid(rawCategoryId)) {
        const { data: byName2 } = await supabaseAdmin
          .from('categories')
          .select('id')
          .ilike('name', rawCategoryId)
          .limit(1)
          .maybeSingle()
        const found = (byName2 as any)?.id ?? null
        if (found) {
          categoryId = categoriesUsesUuidId ? (looksLikeUuid(found) ? found : null) : String(found)
        }
      }

      if (!categoryId) {
        if (!categoriesUsesUuidId) {
          categoryId = 'other'
        } else {
          if (categoriesHasSlug) {
            const { data: otherSlug, error: otherSlugError } = await supabaseAdmin
              .from('categories')
              .select('id')
              .eq('slug', 'other')
              .limit(1)
              .maybeSingle()
            if (!otherSlugError) {
              const found = (otherSlug as any)?.id ?? null
              if (found && looksLikeUuid(found)) categoryId = found
            }
          }

          if (!categoryId) {
            const { data: otherName } = await supabaseAdmin
              .from('categories')
              .select('id')
              .ilike('name', 'Other')
              .limit(1)
              .maybeSingle()
            const found = (otherName as any)?.id ?? null
            if (found && looksLikeUuid(found)) categoryId = found
          }
        }
      }
    } catch {
      // categoryId stays null
    }

    const productsCategoryType = await getColumnType('products', 'category')
    const productsCategoryIdType = await getColumnType('products', 'category_id')
    const productsHasCategory = Boolean(productsCategoryType)
    const productsHasCategoryId = Boolean(productsCategoryIdType)
    const productsCategoryIsUuid = isUuidColumn(productsCategoryType)
    const productsCategoryIdIsUuid = isUuidColumn(productsCategoryIdType)

    const categoryIdForUuidColumn =
      categoriesUsesUuidId && categoryId && looksLikeUuid(categoryId) ? categoryId : null

    // For text-backed category ids, prefer the provided slug/id; otherwise store the name.
    const categoryIdForTextColumn = !categoriesUsesUuidId && categoryId ? categoryId : rawCategoryId || null
    const categoryTextValue = String(beezioCategory || '').trim() || rawCategoryId || null

    const insertPayload: any = {
      seller_id: sellerProfileId,
      title: cjProduct.productNameEn,
      description: (() => {
        const cleaned = sanitizeImportedDescription(detailed?.description || '')
        if (cleaned) return cleaned
        return `${cjProduct.productNameEn}. Earn ${pricing.affiliateCommission}% commission!`
      })(),
      // Store both the customer-facing price and the seller_ask so other parts of the app
      // (pricing engine, checkout, analytics) can consistently recompute/validate totals.
      price: finalPrice,
      calculated_customer_price: finalPrice,
      seller_ask: sellerAsk,
      seller_amount: sellerAsk,
      seller_ask_price: sellerAsk,
      currency: 'USD',
      image_url: normalizedImages[0] ?? cjProduct.productImage,
      images: normalizedImages,
      sku: (selectedVariant as any)?.variantSku || cjProduct.productSku,
      variants: variants.length > 0 ? variants : null,
      requires_shipping: true,
      shipping_cost: shippingCost,
      affiliate_enabled: true,
      commission_rate: pricing.affiliateCommission,
      commission_type: 'percentage',
      flat_commission_amount: 0,
      stock_quantity: productStockQuantity,
      dropship_provider: 'cj',
      product_type: 'one_time',
      lineage: 'CJ',
      is_promotable: true,
      is_active: true,
      tags: [],
      videos: [],
      views_count: 0,
      clicks_count: 0,
      conversions_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Apply category fields safely across different schemas:
    // - Some schemas have `products.category_id` (uuid or text)
    // - Some schemas have `products.category` (text or uuid)
    // Never send slugs (e.g. "sports-outdoors") to uuid columns.
    if (productsHasCategoryId) {
      if (productsCategoryIdIsUuid) {
        insertPayload.category_id = categoryIdForUuidColumn
      } else {
        insertPayload.category_id = categoryIdForTextColumn
      }
    }

    if (productsHasCategory) {
      if (productsCategoryIsUuid) {
        insertPayload.category = categoryIdForUuidColumn
      } else {
        insertPayload.category = categoryTextValue
      }
    }

    // Insert with a small amount of schema self-healing: if PostgREST reports an unknown column,
    // drop that field and retry a few times.
    let product: any = null
    let productError: any = null
    const maxAttempts = 6
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { data, error } = await supabaseAdmin
        .from('products')
        .upsert(insertPayload, { onConflict: 'sku' })
        .select()
        .single()

      if (!error) {
        product = data
        productError = null
        break
      }

      productError = error
      const message = String((error as any)?.message || '')
      const match = message.match(/Could not find the ['"]([^'\"]+)['"] column/i)
      const unknownCol = match?.[1]
      if (unknownCol) {
        const normalized = unknownCol.trim().toLowerCase()
        const matchingKey = Object.keys(insertPayload).find(key => key.toLowerCase() === normalized)
        if (matchingKey) {
          delete insertPayload[matchingKey]
          continue
        }
      }

      break
    }

    if (productError) {
      return json(400, {
        error: 'Failed to insert product',
        details: productError.message,
        code: productError.code,
        hint: (productError as any).hint,
      })
    }

    const variantFallbackImage = normalizedImages[0] ?? cjProduct.productImage
    const variantBasePrice = safeCjCost > 0 ? safeCjCost : parseCJPriceToUSD(cjProduct.sellPrice)

    try {
      await upsertProductVariants(
        supabaseAdmin,
        product.id,
        variants,
        variantFallbackImage,
        resolvedInventory,
        variantBasePrice,
        cjProduct.pid,
        cjProduct.productSku
      )
    } catch (variantError) {
      console.error('Variants sync warning:', variantError)
    }

    try {
      await upsertDefaultShippingOption(supabaseAdmin, product.id, shippingCost)
    } catch (shippingError) {
      console.error('Default shipping option sync warning:', shippingError)
    }

    const { error: mappingError } = await supabaseAdmin
      .from('cj_product_mappings')
      .insert({
        beezio_product_id: product.id,
        cj_product_id: cjProduct.pid,
        cj_product_sku: cjProduct.productSku,
        cj_variant_id: (selectedVariant as any)?.vid ?? null,
        cj_cost: cjCost,
        markup_percent: pricing.markup,
        affiliate_commission_percent: pricing.affiliateCommission,
        price_breakdown: {
          finalPrice,
          sellerAsk,
          selectedVariant: selectedVariant ? {
            vid: (selectedVariant as any)?.vid,
            variantSku: (selectedVariant as any)?.variantSku,
            variantNameEn: (selectedVariant as any)?.variantNameEn,
            variantSellPrice: (selectedVariant as any)?.variantSellPrice,
          } : null,
          inventory: resolvedInventory,
          shippingCost,
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
