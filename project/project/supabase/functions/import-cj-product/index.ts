import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { normalizeCjDetailPayload } from '../../../shared/cjIdentity.ts'
import { getReferrerBonusPerItem } from '../../../shared/referralBonus.ts'

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
    productVideo?: string
    productVideoUrl?: string
    productVideoList?: string[]
    videoList?: string[]
    videos?: string[]
    logisticList?: any[]
    shippingList?: any[]
    logistics?: any[]
    shippingOptions?: any[]
    warehouseName?: string
    shipFrom?: string
    originCountry?: string
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
    affiliateCommissionType?: 'percent' | 'flat'
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

const DEFAULT_PROCESSING_PCT = 0.029
const DEFAULT_PROCESSING_FLAT = 0.30

const resolveProcessingPct = () => {
  const raw = String(Deno.env.get('PROCESSING_FEE_PERCENT') || Deno.env.get('STRIPE_PROCESSING_FEE_PCT') || '').trim()
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_PROCESSING_PCT
  return value > 1 ? value / 100 : value
}

const resolveProcessingFlat = () => {
  const centsRaw = String(Deno.env.get('STRIPE_PROCESSING_FEE_FIXED_CENTS') || '').trim()
  const cents = Number(centsRaw)
  if (Number.isFinite(cents) && cents > 0) return cents / 100
  const raw = String(Deno.env.get('PROCESSING_FEE_FIXED') || '').trim()
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) return DEFAULT_PROCESSING_FLAT
  return value
}

const calculateSamplePriceFromCost = (baseCost: number): number => {
  if (!Number.isFinite(baseCost) || baseCost <= 0) return 0
  const markup = baseCost > 15 ? 2 : 1
  const targetNet = baseCost + markup
  const pct = resolveProcessingPct()
  const flat = resolveProcessingFlat()
  const gross = (targetNet + flat) / (1 - pct)
  return roundToTwo(gross)
}

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

  const matches = raw.match(/-?\d+(?:\.\d+)?/g) || []
  const normalized = matches
    .map((token) => {
      const parsed = Number(token)
      if (!Number.isFinite(parsed) || parsed <= 0) return null
      const hadDecimal = token.includes('.')
      if (!hadDecimal && Number.isInteger(parsed) && parsed >= 1000 && parsed <= 1000000) {
        return roundToTwo(parsed / 100)
      }
      return roundToTwo(parsed)
    })
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)

  if (!normalized.length) return 0
  return Math.max(...normalized)
}

const GRAMS_PER_OUNCE = 28.3495

const toWeightOz = (value: unknown): number => {
  const raw = Number(value)
  if (!Number.isFinite(raw) || raw <= 0) return 0
  // Heuristic: CJ often returns grams. Treat larger numbers as grams.
  if (raw >= 50) {
    return Math.max(0, Math.round(raw / GRAMS_PER_OUNCE))
  }
  return Math.max(0, Math.round(raw))
}

const resolveBaseWeightOz = (detailed: any, cjProduct: any): number => {
  const candidates = [
    detailed?.packingWeight,
    detailed?.productWeight,
    detailed?.weight,
    detailed?.packingWeightOz,
    detailed?.productWeightOz,
    cjProduct?.packingWeight,
    cjProduct?.productWeight,
    cjProduct?.weight,
  ]
  for (const candidate of candidates) {
    const oz = toWeightOz(candidate)
    if (oz > 0) return oz
  }
  return 0
}

const extractImageUrls = (value: unknown): string[] => {
  if (!value) return []
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean)
  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return []
    if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('{') && raw.endsWith('}'))) {
      try {
        const parsed = JSON.parse(raw)
        return extractImageUrls(parsed)
      } catch {
        // Fall through to simple string parsing.
      }
    }
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

const buildUniqueProductSku = (params: {
  baseSku?: string | null
  cjPid?: string | null
  cjProductId?: string | null
  cjVid?: string | null
  cjVariantId?: string | null
  nonce?: string | null
}): string => {
  const baseSku = String(params.baseSku || '').trim()
  const productRef = String(params.cjPid || params.cjProductId || '').trim()
  const variantRef = String(params.cjVid || params.cjVariantId || '').trim()
  const nonce = String(params.nonce || '').trim()
  const suffix = [productRef, variantRef, nonce].filter(Boolean).join('-') || 'CJ'
  const normalizedSuffix = suffix.replace(/[^a-zA-Z0-9_-]+/g, '-')
  const fallbackBase = baseSku || 'CJ'
  const compactBase = fallbackBase.replace(/\s+/g, ' ').trim().slice(0, 80)
  return `${compactBase}__${normalizedSuffix}`.slice(0, 120)
}

const buildSkuNonce = () => Date.now().toString(36).slice(-8)

const assertExactCjIdentityMatch = (params: {
  requestedPid?: string | null
  requestedProductSku?: string | null
  selectedVariantVid?: string | null
  normalizedCj: ReturnType<typeof normalizeCjDetailPayload>
}) => {
  const requestedPid = String(params.requestedPid || '').trim()
  const requestedProductSku = String(params.requestedProductSku || '').trim()
  const selectedVariantVid = String(params.selectedVariantVid || '').trim()

  const productIdentifiers = new Set(
    [
      params.normalizedCj.cj_pid,
      params.normalizedCj.cj_product_id,
      params.normalizedCj.cj_product_sku,
      params.normalizedCj.cj_product_code,
      params.normalizedCj.cj_spu,
    ]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
  )

  if (requestedPid && !productIdentifiers.has(requestedPid)) {
    throw new Error(`CJ detail mismatch: requested pid ${requestedPid} but resolved detail did not match.`)
  }

  if (requestedProductSku && !productIdentifiers.has(requestedProductSku)) {
    throw new Error(`CJ detail mismatch: requested SKU ${requestedProductSku} but resolved detail did not match.`)
  }

  if (!selectedVariantVid) return

  const matchedVariant = params.normalizedCj.variants.find((variant) => {
    const variantIdentifiers = new Set(
      [
        variant.cj_vid,
        variant.cj_variant_id,
        variant.cj_variant_sku,
        variant.cj_variant_code,
        variant.cj_sku,
        variant.variant_display_sku,
      ]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
    )
    return variantIdentifiers.has(selectedVariantVid)
  })

  if (!matchedVariant) {
    throw new Error(`CJ detail mismatch: selected variant ${selectedVariantVid} was not found on the resolved CJ product.`)
  }
}

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const normalizeVideoUrl = (value: unknown): string => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.startsWith('//')) return `https:${raw}`
  return raw
}

const extractVideoUrls = (value: unknown): string[] => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => extractVideoUrls(entry))
      .map(normalizeVideoUrl)
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return []
    if (raw.includes(',')) {
      return raw
        .split(',')
        .map((part) => normalizeVideoUrl(part))
        .filter(Boolean)
    }
    return [normalizeVideoUrl(raw)].filter(Boolean)
  }
  if (typeof value === 'object') {
    const candidate =
      (value as any)?.videoUrl ??
      (value as any)?.video_url ??
      (value as any)?.url ??
      (value as any)?.video ??
      (value as any)?.src ??
      ''
    return candidate ? [normalizeVideoUrl(candidate)].filter(Boolean) : []
  }
  return []
}

const extractVideosFromCjPayload = (detailed: any, variants: any[], clientVideos: unknown[] = []): string[] => {
  const fromDetail = [
    ...extractVideoUrls(detailed?.productVideoList),
    ...extractVideoUrls(detailed?.videoList),
    ...extractVideoUrls(detailed?.videos),
    ...extractVideoUrls(detailed?.productVideo),
    ...extractVideoUrls(detailed?.productVideoUrl),
    ...extractVideoUrls(detailed?.videoUrl),
  ]

  const fromVariants = (Array.isArray(variants) ? variants : []).flatMap((variant: any) => [
    ...extractVideoUrls(variant?.videoUrl),
    ...extractVideoUrls(variant?.video),
    ...extractVideoUrls(variant?.videos),
  ])

  return uniqueStrings([...fromDetail, ...fromVariants, ...extractVideoUrls(clientVideos)]).slice(0, 12)
}

const deriveEstimatedDays = (value: unknown): string => {
  const raw = String(value || '').trim()
  if (!raw) return '5-12 business days'
  return raw
}

const extractShippingOptionsFromCjPayload = (params: {
  detailed: any
  variants: any[]
  fallbackShippingCost: number
  clientShippingOptions?: unknown[]
}): Array<{ name: string; cost: number; estimated_days: string; origin_country?: string; origin_label?: string; processing_time?: string }> => {
  const { detailed, variants, fallbackShippingCost, clientShippingOptions } = params

  const rows = [
    ...(Array.isArray(detailed?.logisticList) ? detailed.logisticList : []),
    ...(Array.isArray(detailed?.shippingList) ? detailed.shippingList : []),
    ...(Array.isArray(detailed?.shippingOptions) ? detailed.shippingOptions : []),
    ...(Array.isArray(detailed?.logistics) ? detailed.logistics : []),
    ...(Array.isArray(detailed?.deliveryList) ? detailed.deliveryList : []),
    ...(Array.isArray(detailed?.data?.logisticList) ? detailed.data.logisticList : []),
    ...(Array.isArray(detailed?.data?.shippingList) ? detailed.data.shippingList : []),
    ...(Array.isArray(detailed?.data?.shippingOptions) ? detailed.data.shippingOptions : []),
    ...(Array.isArray(detailed?.data?.logistics) ? detailed.data.logistics : []),
    ...(Array.isArray(variants) ? variants.flatMap((v: any) => (Array.isArray(v?.shippingOptions) ? v.shippingOptions : [])) : []),
    ...(Array.isArray(clientShippingOptions) ? clientShippingOptions : []),
  ]

  const normalized = rows
    .map((row: any) => {
      const name = String(
        row?.logisticName ??
          row?.logisticsName ??
          row?.shippingMethod ??
          row?.methodName ??
          row?.name ??
          row?.channelName ??
          ''
      ).trim()

      const costRaw =
        row?.logisticPrice ??
        row?.shippingFee ??
        row?.freight ??
        row?.price ??
        row?.cost ??
        row?.amount
      const cost = toFiniteNumber(costRaw)

      const estimated = deriveEstimatedDays(
        row?.logisticAging ??
          row?.deliveryTime ??
          row?.aging ??
          row?.estimatedDays ??
          row?.deliveryDays ??
          row?.timeLimit
      )

      const originCountry = String(
        row?.originCountry ?? row?.country ?? row?.countryCode ?? detailed?.originCountry ?? detailed?.countryCode ?? ''
      ).trim()
      const originLabel = String(
        row?.warehouseName ?? row?.warehouse ?? row?.shipFrom ?? detailed?.warehouseName ?? detailed?.shipFrom ?? ''
      ).trim()
      const processingTime = String(row?.processingTime ?? row?.processingDays ?? detailed?.processingTime ?? '').trim()

      if (!name) return null
      return {
        name,
        cost: cost !== null && cost >= 0 ? Math.round((cost + Number.EPSILON) * 100) / 100 : Math.max(0, fallbackShippingCost),
        estimated_days: estimated,
        ...(originCountry ? { origin_country: originCountry } : {}),
        ...(originLabel ? { origin_label: originLabel } : {}),
        ...(processingTime ? { processing_time: processingTime } : {}),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  const deduped: Array<{ name: string; cost: number; estimated_days: string; origin_country?: string; origin_label?: string; processing_time?: string }> = []
  const seen = new Set<string>()
  for (const option of normalized) {
    const key = `${option.name.toLowerCase()}::${option.estimated_days.toLowerCase()}::${option.cost}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(option)
    if (deduped.length >= 8) break
  }

  if (deduped.length > 0) return deduped

  const fallbackOriginCountry = String(detailed?.originCountry ?? detailed?.countryCode ?? '').trim()
  const fallbackOriginLabel = String(detailed?.warehouseName ?? detailed?.shipFrom ?? '').trim()

  return [
    {
      name: 'CJ Shipping',
      cost: Math.max(0, Math.round((fallbackShippingCost + Number.EPSILON) * 100) / 100),
      estimated_days: '5-12 business days',
      ...(fallbackOriginCountry ? { origin_country: fallbackOriginCountry } : {}),
      ...(fallbackOriginLabel ? { origin_label: fallbackOriginLabel } : {}),
    },
  ]
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
  productSku: string,
  pricing: {
    markup: number
    affiliateValue: number
    affiliateType: 'percent' | 'flat'
  }
) => {
  const normalizedDetail = normalizeCjDetailPayload(
    {
      pid: cjProductId,
      productSku,
      variants,
    } as Record<string, unknown>,
    { importVersion: 'cj-import-v2' }
  )
  const canonicalVariantById = new Map(
    normalizedDetail.variants.map((variant) => [String(variant.cj_vid || variant.cj_variant_id || '').trim(), variant])
  )
  const normalizedRows = variants
    .map(variant => {
      if (!variant?.vid) return null
      const canonicalVariant = canonicalVariantById.get(String(variant.vid).trim()) || null
      // Normalize all possible fields
      const supplierCost = parseCJPriceToUSD(variant.variantSellPrice ?? basePrice)
      const safeSupplierCost = Number.isFinite(supplierCost) && supplierCost > 0 ? supplierCost : basePrice
      const rawMarkup = safeSupplierCost * (Math.max(0, Number(pricing.markup || 0)) / 100)
      const sellerAsk = roundToTwo(safeSupplierCost + Math.max(rawMarkup, MIN_CJ_MARKUP))
      const retailPrice = calculateFinalPriceFromAsk(
        sellerAsk,
        pricing.affiliateType === 'percent' ? Math.max(0, Number(pricing.affiliateValue || 0)) : 0,
        pricing.affiliateType === 'flat' ? Math.max(0, Number(pricing.affiliateValue || 0)) : 0,
        pricing.affiliateType
      )
      const sku = canonicalVariant?.variant_display_sku || String(variant.variantSku || '').trim() || `CJ Variant ID: ${variant.vid}`
      const inventoryCandidate =
        variant.variantStock ??
        (variant as any)?.stock ??
        (variant as any)?.inventory ??
        (variant as any)?.inventoryNum ??
        (variant as any)?.variantInventoryNum ??
        NaN
      const inventoryNumber = Number(inventoryCandidate)
      const hasKnownInventory = Number.isFinite(inventoryNumber) && inventoryNumber >= 0
      const inventory = hasKnownInventory ? Math.max(0, Math.floor(inventoryNumber)) : null
      // Collect all known and unknown fields
      const extraFields: Record<string, any> = {}
      for (const key in variant) {
        if (!['vid','variantSku','variantNameEn','variantImage','variantSellPrice','variantStock','variantKey'].includes(key)) {
          extraFields[key] = variant[key]
        }
      }
      const weightCandidate =
        (variant as any)?.variantWeight ??
        (variant as any)?.weight ??
        (variant as any)?.weightOz ??
        (variant as any)?.weight_oz ??
        (variant as any)?.variantWeightOz ??
        (variant as any)?.variantWeightG ??
        null
      const weightOz = toWeightOz(weightCandidate)
      return {
        product_id: productId,
        provider: 'CJ',
        source: 'cj',
        source_platform: 'cj',
        cj_product_id: cjProductId,
        cj_variant_id: variant.vid,
        cj_vid: canonicalVariant?.cj_vid || String(variant.vid || '').trim() || null,
        cj_variant_sku: canonicalVariant?.cj_variant_sku || String(variant.variantSku || '').trim() || null,
        cj_variant_code: canonicalVariant?.cj_variant_code || String((variant as any)?.variantCode || '').trim() || null,
        cj_sku: canonicalVariant?.cj_sku || String((variant as any)?.sku || '').trim() || null,
        cj_option_summary: canonicalVariant?.option_summary || null,
        supplier_variant_ref: canonicalVariant?.supplier_variant_ref || String((variant as any)?.variantKey || '').trim() || null,
        external_inventory_key: canonicalVariant?.external_inventory_key || String(variant.vid || '').trim() || null,
        variant_display_sku: canonicalVariant?.variant_display_sku || sku,
        searchable_codes: canonicalVariant?.searchable_codes || [],
        is_orderable: canonicalVariant?.is_orderable ?? true,
        order_reference_type: canonicalVariant?.order_reference_type || 'cj_vid',
        raw_variant_payload_json: canonicalVariant?.raw_variant_payload_json || variant,
        import_status: canonicalVariant?.warnings?.length ? 'needs_review' : 'ready',
        external_product_id: cjProductId,
        external_variant_id: variant.vid,
        sku,
        title:
          String(variant.variantNameEn || '').trim() ||
          String((variant as any)?.variantName || '').trim() ||
          String((variant as any)?.variantKey || '').trim() ||
          sku,
        price: retailPrice > 0 ? retailPrice : safeSupplierCost,
        cost_cents: Math.round(safeSupplierCost * 100),
        retail_price_cents: Math.round((retailPrice > 0 ? retailPrice : safeSupplierCost) * 100),
        compare_at_price: null,
        currency: 'USD',
        weight_oz: weightOz,
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
        in_stock: hasKnownInventory ? inventory > 0 : true,
        inventory_policy: hasKnownInventory ? 'deny' : 'continue',
        inventory_source: 'cj',
        is_active: true,
        external_data: {
          raw_variant: variant,
          shipping_options: Array.isArray((variant as any)?.shippingOptions) ? (variant as any).shippingOptions : [],
        },
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

const PLATFORM_FEE_PERCENT = 10
const STRIPE_PERCENT = 3.0
const STRIPE_FIXED_FEE = 0.6
const MIN_AFFILIATE_COMMISSION = 0
const MIN_PLATFORM_FEE = 1
const MIN_CJ_MARKUP = 0

const influencerBonusPoolSurcharge = (askPrice: number, slotCount: number = 2): number => {
  const perSlotBonus = getReferrerBonusPerItem(Number.isFinite(askPrice) ? askPrice : 0)
  const normalizedSlotCount = Number.isFinite(slotCount) ? Math.max(0, Math.floor(slotCount)) : 0
  return roundToTwo(perSlotBonus * normalizedSlotCount)
}

const calculateFinalPriceFromAsk = (
  askPrice: number,
  affiliatePercent: number,
  affiliateFlatAmount: number,
  affiliateType: 'percent' | 'flat',
  platformFlatAmount?: number,
  influencerSlotCount: number = 2
): number => {
  const safeFlat = Number.isFinite(affiliateFlatAmount) ? affiliateFlatAmount : 0
  const safePlatformFlat = Number.isFinite(platformFlatAmount) ? Math.max(0, Number(platformFlatAmount)) : NaN
  const pAff = (Number.isFinite(affiliatePercent) ? affiliatePercent : 0) / 100
  const pPlatform = PLATFORM_FEE_PERCENT / 100
  const pStripe = STRIPE_PERCENT / 100
  const denom = 1 - pStripe
  if (denom <= 0) return 0

  const influencerPool = influencerBonusPoolSurcharge(askPrice, influencerSlotCount)
  const computedAffiliate = affiliateType === 'flat' ? safeFlat : askPrice * pAff
  const affiliateAmount = Math.max(computedAffiliate, MIN_AFFILIATE_COMMISSION)
  const computedPlatform = (askPrice + affiliateAmount) * pPlatform
  const basePlatformAmount = Number.isFinite(safePlatformFlat)
    ? safePlatformFlat
    : Math.max(computedPlatform, MIN_PLATFORM_FEE)
  const platformAmount = roundToTwo(basePlatformAmount + influencerPool)
  const targetNetAfterStripe = askPrice + affiliateAmount + platformAmount
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

    const emailWhitelisted = email === 'jason@beezio.co' || email === 'jasonlovingsr@gmail.com' || email === 'shop@beezio.co'
    let isAllowed = emailWhitelisted
    let callerRole = ''
    if (!isAllowed) {
      try {
        const { data: callerProfile } = await supabaseAdmin
          .from('profiles')
          .select('role, primary_role')
          .eq('user_id', user.id)
          .maybeSingle()
        callerRole = (callerProfile?.primary_role || callerProfile?.role || '').toLowerCase()
        isAllowed = callerRole === 'admin'
      } catch {
        isAllowed = false
      }
    }
    if (!callerRole && emailWhitelisted) callerRole = 'admin'

    if (!isAllowed) {
      return json(403, { error: 'Forbidden' })
    }

    // Resolve the caller profile id for FK constraints (products.seller_id -> profiles.id)
    const defaultRole = email === 'jason@beezio.co' || email === 'jasonlovingsr@gmail.com' || email === 'shop@beezio.co' ? 'admin' : 'buyer'
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

    const pricing = body?.pricing || { markup: 3, affiliateCommission: 5 }
    const detailed = body?.detailedProduct || null
    const selectedVariant = body?.selectedVariant || null
    const variants = (body?.variants ?? []) as ImportVariant[]
    const inventory = body?.inventory
    const numericInventory = inventory !== null && inventory !== undefined ? Number(inventory) : NaN
    const resolvedInventory = Number.isFinite(numericInventory) && numericInventory >= 0 ? numericInventory : null

    // If variant stocks are provided, prefer a product-level stock count equal to the sum of variant inventories.
    // This keeps products.stock_quantity meaningful when variant selection isn't used.
    const variantInventoryAggregation = Array.isArray(variants)
      ? (variants as ImportVariant[]).reduce(
          (acc, variant) => {
            const candidate = Number((variant as any)?.variantStock ?? (variant as any)?.inventory ?? (variant as any)?.inventoryNum)
            if (!Number.isFinite(candidate) || candidate < 0) return acc
            acc.sum += Math.floor(candidate)
            acc.knownCount += 1
            return acc
          },
          { sum: 0, knownCount: 0 }
        )
      : null

    const variantInventorySum =
      variantInventoryAggregation && variantInventoryAggregation.knownCount > 0
        ? variantInventoryAggregation.sum
        : null

    const hasKnownInventory =
      (typeof variantInventorySum === 'number' && Number.isFinite(variantInventorySum)) ||
      (typeof resolvedInventory === 'number' && Number.isFinite(resolvedInventory))

    const productStockQuantity =
      typeof variantInventorySum === 'number' && Number.isFinite(variantInventorySum)
        ? variantInventorySum
        : (typeof resolvedInventory === 'number' && Number.isFinite(resolvedInventory) ? resolvedInventory : null);
    const shippingCostInput = Number(body?.shippingCost ?? 0);
    const shippingCost = Number.isFinite(shippingCostInput) && shippingCostInput >= 0 ? shippingCostInput : 0;
    const shippingOptions = extractShippingOptionsFromCjPayload({
      detailed,
      variants,
      fallbackShippingCost: shippingCost,
      clientShippingOptions: Array.isArray((body as any)?.shippingOptions) ? (body as any).shippingOptions : [],
    })
    const shippingCostResolved = shippingOptions.length
      ? Math.min(...shippingOptions.map((option) => Number(option.cost || 0)).filter((value) => Number.isFinite(value) && value >= 0))
      : shippingCost
    const customerFacingShippingOptions = shippingOptions.map((option) => ({
      ...option,
      cost: 0,
    }))
    const customerFacingShippingCost = 0
    const videos = extractVideosFromCjPayload(
      detailed,
      variants,
      Array.isArray((body as any)?.videos) ? (body as any).videos : []
    )
    const originTag = String(shippingOptions[0]?.origin_label || shippingOptions[0]?.origin_country || '').trim()
    const importTags = uniqueStrings([
      ...(originTag ? [`Ships from: ${originTag}`] : []),
      ...(String((detailed as any)?.brandName || (detailed as any)?.brand || '').trim()
        ? [`Brand: ${String((detailed as any)?.brandName || (detailed as any)?.brand || '').trim()}`]
        : []),
      'CJ Imported',
    ])
    const beezioCategory = String(body?.beezioCategory || '').trim() || null

    // Compute pricing server-side to avoid client/UI drift.
    const variantCostCandidate = selectedVariant && Object.prototype.hasOwnProperty.call(selectedVariant, 'variantSellPrice')
      ? (selectedVariant as any).variantSellPrice
      : undefined
    const cjUnitCost = parseCJPriceToUSD(variantCostCandidate ?? (cjProduct as any).sellPrice)
    const markup = Number(pricing?.markup ?? 0)
    const markupTypeRaw = String(pricing?.markupType || 'percent').toLowerCase()
    const markupType: 'percent' | 'flat' = markupTypeRaw === 'flat' ? 'flat' : 'percent'
    const affiliateValue = Number(pricing?.affiliateCommission ?? 0)
    const affiliateTypeRaw = String(pricing?.affiliateCommissionType || 'percent').toLowerCase()
    const affiliateType: 'percent' | 'flat' = affiliateTypeRaw === 'flat' ? 'flat' : 'percent'
    const platformFeeValue = Number(pricing?.platformFee ?? NaN)
    const safeCjUnitCost = Number.isFinite(cjUnitCost) && cjUnitCost > 0 ? cjUnitCost : 0
    const safeCjCost = roundToTwo(safeCjUnitCost + Math.max(0, shippingCostResolved))
    const safeMarkup = Number.isFinite(markup) && markup >= 0 ? markup : 0
    const safeAffiliateValue = Number.isFinite(affiliateValue) && affiliateValue >= 0 ? affiliateValue : 0
    const safePlatformFee = Number.isFinite(platformFeeValue) && platformFeeValue >= 0 ? roundToTwo(platformFeeValue) : null

    const rawMarkup = markupType === 'flat' ? safeMarkup : safeCjCost * (safeMarkup / 100)
    const sellerAsk = roundToTwo(safeCjCost + Math.max(rawMarkup, MIN_CJ_MARKUP))
    const affiliateAmount = Math.max(
      affiliateType === 'flat' ? safeAffiliateValue : sellerAsk * (safeAffiliateValue / 100),
      MIN_AFFILIATE_COMMISSION
    )
    const basePlatformAmount = safePlatformFee !== null
      ? safePlatformFee
      : Math.max((sellerAsk + affiliateAmount) * (PLATFORM_FEE_PERCENT / 100), MIN_PLATFORM_FEE)
    const influencerSlotCount = callerRole === 'admin' ? 1 : 2
    const influencerBonusPool = influencerBonusPoolSurcharge(sellerAsk, influencerSlotCount)
    const platformAmount = roundToTwo(basePlatformAmount + influencerBonusPool)
    const finalPrice = calculateFinalPriceFromAsk(
      sellerAsk,
      affiliateType === 'percent' ? safeAffiliateValue : 0,
      affiliateType === 'flat' ? safeAffiliateValue : 0,
      affiliateType,
      basePlatformAmount,
      influencerSlotCount
    )
    const samplePrice = calculateSamplePriceFromCost(safeCjCost)
    const sampleEnabled = samplePrice > 0

    if (!Number.isFinite(finalPrice) || finalPrice <= 0 || !Number.isFinite(sellerAsk) || sellerAsk <= 0) {
      return json(400, {
        error: 'Invalid pricing inputs',
        details: { cjCost: (cjProduct as any).sellPrice, normalizedCjCost: cjUnitCost, landedCjCost: safeCjCost, markup: pricing?.markup, markupType, affiliateCommission: pricing?.affiliateCommission, affiliateType, platformFee: pricing?.platformFee, minAffiliate: MIN_AFFILIATE_COMMISSION, minPlatform: MIN_PLATFORM_FEE },
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

    const canonicalDetailPayload = {
      ...(detailed || {}),
      ...(cjProduct || {}),
      productImageList: normalizedImages,
      variants,
    }
    const normalizedCj = normalizeCjDetailPayload(canonicalDetailPayload as Record<string, unknown>, {
      importVersion: 'cj-import-v2',
    })
    assertExactCjIdentityMatch({
      requestedPid: String(cjProduct?.pid || '').trim() || null,
      requestedProductSku: String(cjProduct?.productSku || '').trim() || null,
      selectedVariantVid: String((selectedVariant as any)?.vid || '').trim() || null,
      normalizedCj,
    })
    const normalizedVariantById = new Map(
      normalizedCj.variants.map((variant) => [
        String(variant.cj_vid || variant.cj_variant_id || '').trim(),
        variant,
      ])
    )
    const selectedCanonicalVariant =
      normalizedVariantById.get(String((selectedVariant as any)?.vid || '').trim()) ||
      normalizedCj.variants[0] ||
      null

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

    const baseWeightOz = resolveBaseWeightOz(detailed, cjProduct)
    const safeDisplaySku = selectedCanonicalVariant?.variant_display_sku || normalizedCj.display_search_code || null
    const ensureUniqueSku = async (candidate: string | null): Promise<string | null> => {
      const normalizedCandidate = String(candidate || '').trim()
      if (!normalizedCandidate) return null

      try {
        const { data: existing } = await supabaseAdmin
          .from('products')
          .select('id,cj_product_id,cj_pid,sku')
          .eq('sku', normalizedCandidate)
          .limit(5)

        const matchesSameProduct = Array.isArray(existing) && existing.some((row: any) => {
          const existingProductId = String(row?.cj_product_id || '').trim()
          const existingPid = String(row?.cj_pid || '').trim()
          return (
            (existingProductId && existingProductId === String(normalizedCj.cj_product_id || '').trim()) ||
            (existingPid && existingPid === String(normalizedCj.cj_pid || '').trim())
          )
        })

        if (!existing || existing.length === 0 || matchesSameProduct) {
          return normalizedCandidate
        }
      } catch {
        return normalizedCandidate
      }

      return buildUniqueProductSku({
        baseSku: normalizedCandidate,
        cjPid: normalizedCj.cj_pid,
        cjProductId: normalizedCj.cj_product_id,
        cjVid: selectedCanonicalVariant?.cj_vid,
        cjVariantId: selectedCanonicalVariant?.cj_variant_id,
        nonce: buildSkuNonce(),
      })
    }

    const resolvedProductSku = await ensureUniqueSku(safeDisplaySku)
    const insertPayload: any = {
      seller_id: sellerProfileId,
      title: normalizedCj.title || cjProduct.productNameEn,
      description: (() => {
        const cleaned = sanitizeImportedDescription(normalizedCj.description || detailed?.description || '')
        if (cleaned) return cleaned
        return affiliateType === 'flat'
          ? `${normalizedCj.title || cjProduct.productNameEn}. Earn $${Math.max(safeAffiliateValue, MIN_AFFILIATE_COMMISSION).toFixed(2)} commission!`
          : `${normalizedCj.title || cjProduct.productNameEn}. Earn ${safeAffiliateValue}% commission!`
      })(),
      source: 'cj',
      cj_product_id: normalizedCj.cj_product_id || String(cjProduct.pid || '').trim() || null,
      cj_pid: normalizedCj.cj_pid,
      cj_product_code: normalizedCj.cj_product_code,
      cj_product_sku: normalizedCj.cj_product_sku,
      cj_spu: normalizedCj.cj_spu,
      cj_name_raw: normalizedCj.cj_name_raw,
      cj_source_payload_json: normalizedCj.cj_source_payload_json,
      searchable_codes: normalizedCj.searchable_codes,
      import_status: normalizedCj.import_status,
      display_search_code: normalizedCj.display_search_code,
      source_import_version: normalizedCj.source_import_version,
      // Store both the customer-facing price and the seller_ask so other parts of the app
      // (pricing engine, checkout, analytics) can consistently recompute/validate totals.
      price: finalPrice,
      calculated_customer_price: finalPrice,
      seller_ask: sellerAsk,
      seller_amount: sellerAsk,
      seller_ask_price: sellerAsk,
      platform_fee: platformAmount,
      currency: 'USD',
      base_weight_oz: baseWeightOz,
      image_url: normalizedImages[0] ?? cjProduct.productImage,
      images: normalizedImages,
      sku: resolvedProductSku,
      variants: variants.length > 0 ? canonicalDetailPayload.variants : null,
      requires_shipping: true,
      shipping_cost: customerFacingShippingCost,
      shipping_price: customerFacingShippingCost,
      shipping_options: customerFacingShippingOptions,
      affiliate_enabled: true,
      commission_rate: affiliateType === 'flat' ? safeAffiliateValue : safeAffiliateValue,
      commission_type: affiliateType === 'flat' ? 'flat_rate' : 'percentage',
      flat_commission_amount: affiliateType === 'flat' ? safeAffiliateValue : 0,
      affiliate_commission_type: affiliateType === 'flat' ? 'flat' : 'percent',
      affiliate_commission_value: safeAffiliateValue,
      source_platform: 'cj',
      external_product_id: normalizedCj.cj_pid || normalizedCj.cj_product_id,
      external_variant_id: selectedCanonicalVariant?.cj_vid || selectedCanonicalVariant?.cj_variant_id || null,
      track_inventory: hasKnownInventory,
      api_integration: {
        enabled: true,
        supplier: 'CJdropshipping',
        supplier_product_id: normalizedCj.cj_pid || normalizedCj.cj_product_id,
        supplier_variant_id: selectedCanonicalVariant?.cj_vid || selectedCanonicalVariant?.cj_variant_id || null,
        supplier_sku: resolvedProductSku,
        supplier_cost: safeCjCost,
        supplier_unit_cost: safeCjUnitCost,
        supplier_shipping_cost: shippingCostResolved,
        brand_name: String((detailed as any)?.brandName || (detailed as any)?.brand || '').trim() || null,
        beezio_platform_fee: platformAmount,
        cj_identity: {
          product: {
            cj_product_id: normalizedCj.cj_product_id,
            cj_pid: normalizedCj.cj_pid,
            cj_product_code: normalizedCj.cj_product_code,
            cj_product_sku: normalizedCj.cj_product_sku,
            cj_spu: normalizedCj.cj_spu,
          },
          selected_variant: selectedCanonicalVariant,
          warnings: normalizedCj.warnings,
        },
      },
      stock_quantity: productStockQuantity,
      total_inventory: productStockQuantity,
      in_stock: hasKnownInventory ? productStockQuantity > 0 : true,
      inventory_source: 'cj',
      dropship_provider: 'cj',
      is_dropshipped: true,
      product_type: 'one_time',
      lineage: 'CJ',
      status: 'active',
      is_promotable: true,
      is_active: true,
      tags: importTags,
      videos,
      views_count: 0,
      clicks_count: 0,
      conversions_count: 0,
      sample_enabled: sampleEnabled,
      sample_price: sampleEnabled ? samplePrice : null,
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

    const optionalProductColumns = [
      'cj_product_id',
      'cj_pid',
      'cj_product_code',
      'cj_product_sku',
      'cj_spu',
      'cj_name_raw',
      'cj_source_payload_json',
      'searchable_codes',
      'import_status',
      'display_search_code',
      'source_import_version',
      'calculated_customer_price',
      'seller_ask',
      'seller_amount',
      'seller_ask_price',
      'platform_fee',
      'base_weight_oz',
      'shipping_price',
      'affiliate_enabled',
      'flat_commission_amount',
      'affiliate_commission_type',
      'affiliate_commission_value',
      'source_platform',
      'external_product_id',
      'external_variant_id',
      'track_inventory',
      'api_integration',
      'total_inventory',
      'inventory_source',
      'dropship_provider',
      'is_dropshipped',
      'lineage',
      'is_promotable',
      'videos',
      'views_count',
      'clicks_count',
      'conversions_count',
      'sample_enabled',
      'sample_price',
    ] as const

    const optionalColumnPresence = await Promise.all(
      optionalProductColumns.map(async (columnName) => [columnName, await hasColumn('products', columnName)] as const)
    )

    for (const [columnName, exists] of optionalColumnPresence) {
      if (!exists && columnName in insertPayload) {
        delete insertPayload[columnName]
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
        .upsert(insertPayload, { onConflict: 'cj_product_id' })
        .select()
        .single()

      if (!error) {
        product = data
        productError = null
        break
      }

      productError = error
      const message = String((error as any)?.message || '')
      const duplicateSku = /duplicate key value/i.test(message) && /products_sku_key/i.test(message)
      if (duplicateSku) {
        insertPayload.sku = buildUniqueProductSku({
          baseSku: insertPayload.sku || safeDisplaySku,
          cjPid: normalizedCj.cj_pid,
          cjProductId: normalizedCj.cj_product_id,
          cjVid: selectedCanonicalVariant?.cj_vid,
          cjVariantId: selectedCanonicalVariant?.cj_variant_id,
          nonce: buildSkuNonce(),
        })
        if (insertPayload?.api_integration) {
          insertPayload.api_integration = {
            ...insertPayload.api_integration,
            supplier_sku: insertPayload.sku,
          }
        }
        continue
      }
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
        cjProduct.productSku,
        {
          markup: safeMarkup,
          affiliateValue: safeAffiliateValue,
          affiliateType,
        }
      )
    } catch (variantError) {
      console.error('Variants sync warning:', variantError)
    }

    try {
      await upsertDefaultShippingOption(supabaseAdmin, product.id, customerFacingShippingCost)
    } catch (shippingError) {
      console.error('Default shipping option sync warning:', shippingError)
    }

    const { error: mappingError } = await supabaseAdmin
      .from('cj_product_mappings')
      .upsert({
        beezio_product_id: product.id,
        cj_product_id: normalizedCj.cj_product_id || cjProduct.pid,
        cj_product_sku: normalizedCj.cj_product_sku || normalizedCj.cj_product_code || normalizedCj.cj_spu,
        cj_variant_id: selectedCanonicalVariant?.cj_vid || selectedCanonicalVariant?.cj_variant_id || null,
        cj_cost: safeCjCost,
        markup_percent: pricing.markup,
        affiliate_commission_percent: affiliateType === 'flat' ? 0 : safeAffiliateValue,
        price_breakdown: {
          finalPrice,
          sellerAsk,
          markupType,
          markupValue: safeMarkup,
          affiliateType,
          affiliateValue: safeAffiliateValue,
          affiliateAmount,
          influencerBonusPool,
          basePlatformAmount,
          platformAmount,
          minAffiliate: MIN_AFFILIATE_COMMISSION,
          minPlatform: MIN_PLATFORM_FEE,
          selectedVariant: selectedVariant ? {
            vid: (selectedVariant as any)?.vid,
            variantSku: (selectedVariant as any)?.variantSku,
            variantNameEn: (selectedVariant as any)?.variantNameEn,
            variantSellPrice: (selectedVariant as any)?.variantSellPrice,
          } : null,
          inventory: resolvedInventory,
          shippingCost,
          shippingCostResolved,
          customerFacingShippingCost,
          cjUnitCost: safeCjUnitCost,
          identifier_snapshot: {
            cjProductId: normalizedCj.cj_product_id,
            cjPid: normalizedCj.cj_pid,
            productCode: normalizedCj.cj_product_code,
            productSku: normalizedCj.cj_product_sku,
            productSpu: normalizedCj.cj_spu,
            variantId: selectedCanonicalVariant?.cj_variant_id || null,
            variantVid: selectedCanonicalVariant?.cj_vid || null,
            variantSku: selectedCanonicalVariant?.cj_variant_sku || null,
            variantCode: selectedCanonicalVariant?.cj_variant_code || null,
            displaySku: selectedCanonicalVariant?.variant_display_sku || null,
          },
          verification: {
            verified: normalizedCj.import_status !== 'needs_review',
            verified_at: new Date().toISOString(),
            source: 'cj_api',
            matched_pid: normalizedCj.cj_pid,
            matched_product_sku: normalizedCj.cj_product_sku,
            matched_product_spu: normalizedCj.cj_spu,
            matched_variant_id: selectedCanonicalVariant?.cj_variant_id || null,
            matched_variant_vid: selectedCanonicalVariant?.cj_vid || null,
            matched_variant_sku: selectedCanonicalVariant?.cj_variant_sku || null,
            matched_variant_code: selectedCanonicalVariant?.cj_variant_code || null,
            warnings: normalizedCj.warnings,
          },
        },
        last_synced: new Date().toISOString(),
      }, { onConflict: 'cj_product_id,cj_variant_id' })

    if (mappingError) {
      // Non-fatal: product exists, mapping can be repaired.
      console.error('CJ mapping insert failed:', mappingError)
    }

    try {
      const { data: visibilityHealed, error: visibilityHealError } = await supabaseAdmin
        .from('products')
        .update({
          seller_id: sellerProfileId,
          status: 'active',
          is_promotable: true,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id)
        .select()
        .single()

      if (visibilityHealError) {
        console.error('CJ visibility repair warning:', visibilityHealError)
      } else if (visibilityHealed) {
        product = visibilityHealed
      }
    } catch (visibilityRepairError) {
      console.error('CJ visibility repair failed:', visibilityRepairError)
    }

    return json(200, {
      product,
      mappingCreated: !mappingError,
      visibility: {
        owner_profile_id: sellerProfileId,
        import_status: normalizedCj.import_status,
        is_active: true,
        is_promotable: product?.is_promotable === true,
        status: String(product?.status || '').trim() || null,
        needs_review: false,
      },
    })
  } catch (e) {
    console.error('import-cj-product error:', e)
    return json(500, { error: 'Unexpected error', details: String((e as any)?.message || e) })
  }
})
