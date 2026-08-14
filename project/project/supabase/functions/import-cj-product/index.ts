import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { normalizeCjDetailPayload } from '../../../shared/cjIdentity.ts'
import { computeFixedTierPricing } from '../../../shared/customerPrice.ts'
import {
  parseCJUsd,
  SUPPLYLINE_PLUS_NAME,
  SUPPLYLINE_PLUS_SLUG,
} from '../../../shared/cjContract.ts'

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
    markupType?: 'percent' | 'flat'
    affiliateCommission: number
    affiliateCommissionType?: 'percent' | 'flat'
  }
  shippingCost?: number
  variantFreightQuotes?: Array<{
    vid: string
    originCountryCode: string
    destinationCountryCode: string
    destinationZip?: string
    logisticName: string
    logisticAging?: string | null
    logisticPrice: number
    taxesFee?: number
    clearanceOperationFee?: number
    tariff?: number
    totalPostageFee: number
    quotedAt: string
  }>
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

const parseCJPriceToUSD = parseCJUsd

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

const MAX_CJ_VIDEO_BYTES = 50 * 1024 * 1024

const isAllowedCjVideoUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase()
    const isCjHost = hostname === 'cjdropshipping.com' || hostname.endsWith('.cjdropshipping.com')
    const isCjOssHost = /^cc-west-[a-z0-9-]+\.oss(?:-[a-z0-9-]+)?\.aliyuncs\.com$/.test(hostname)
    return url.protocol === 'https:' && (isCjHost || isCjOssHost)
  } catch {
    return false
  }
}

const shortSha256 = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest.slice(0, 16)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const cacheCjVideos = async (
  client: any,
  sellerProfileId: string,
  cjProductId: string,
  sourceUrls: string[]
): Promise<string[]> => {
  const allowedUrls = uniqueStrings(sourceUrls).filter(isAllowedCjVideoUrl)
  const cachedUrls: string[] = []

  for (const sourceUrl of allowedUrls) {
    try {
      const response = await fetch(sourceUrl, {
        headers: { Referer: 'https://developers.cjdropshipping.com/' },
      })
      if (!response.ok) throw new Error(`download failed (${response.status})`)

      const contentLength = Number(response.headers.get('content-length') || 0)
      if (Number.isFinite(contentLength) && contentLength > MAX_CJ_VIDEO_BYTES) {
        throw new Error('video exceeds the 50 MB storage limit')
      }

      const contentTypeRaw = String(response.headers.get('content-type') || 'video/mp4').split(';')[0].trim()
      const contentType = contentTypeRaw.startsWith('video/') ? contentTypeRaw : 'video/mp4'
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (!bytes.byteLength || bytes.byteLength > MAX_CJ_VIDEO_BYTES) {
        throw new Error('video is empty or exceeds the 50 MB storage limit')
      }

      const extension = contentType.includes('webm') ? 'webm' : contentType.includes('quicktime') ? 'mov' : 'mp4'
      const digest = await shortSha256(sourceUrl)
      const safePid = String(cjProductId || 'product').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80)
      const objectPath = `${sellerProfileId}/product-videos/cj/${safePid}/${digest}.${extension}`
      const { error: uploadError } = await client.storage
        .from('product-images')
        .upload(objectPath, bytes, { contentType, upsert: true })
      if (uploadError) throw uploadError

      const { data: publicData } = client.storage.from('product-images').getPublicUrl(objectPath)
      const publicUrl = String(publicData?.publicUrl || '').trim()
      if (!publicUrl) throw new Error('storage returned no public video URL')
      cachedUrls.push(publicUrl)
    } catch (error) {
      console.error('CJ video cache warning:', sourceUrl, String((error as any)?.message || error))
    }
  }

  if (allowedUrls.length && !cachedUrls.length) {
    throw new Error('CJ videos were found but none could be cached for reliable playback.')
  }
  return cachedUrls
}

const MAX_CJ_IMAGE_BYTES = 15 * 1024 * 1024

const isAllowedCjImageUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase()
    const isCjHost = hostname === 'cjdropshipping.com' || hostname.endsWith('.cjdropshipping.com')
    // CJ's current product API documentation also returns images from its
    // `cc-west-*` Alibaba OSS buckets.
    const isCjOssHost = /^cc-west-[a-z0-9-]+\.oss(?:-[a-z0-9-]+)?\.aliyuncs\.com$/.test(hostname)
    return url.protocol === 'https:' && (isCjHost || isCjOssHost)
  } catch {
    return false
  }
}

type CachedCjImages = {
  urls: string[]
  bySource: Map<string, string>
}

const cacheCjImages = async (
  client: any,
  sellerProfileId: string,
  cjProductId: string,
  sourceUrls: string[]
): Promise<CachedCjImages> => {
  const requestedUrls = uniqueStrings(sourceUrls).slice(0, 10)
  const allowedUrls = requestedUrls.filter(isAllowedCjImageUrl)
  const cachedUrls: string[] = []
  const bySource = new Map<string, string>()

  for (const sourceUrl of allowedUrls) {
    try {
      const response = await fetch(sourceUrl, {
        headers: { Referer: 'https://developers.cjdropshipping.com/' },
      })
      if (!response.ok) throw new Error(`download failed (${response.status})`)

      const contentLength = Number(response.headers.get('content-length') || 0)
      if (Number.isFinite(contentLength) && contentLength > MAX_CJ_IMAGE_BYTES) {
        throw new Error('image exceeds the 15 MB storage limit')
      }

      const contentTypeRaw = String(response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
      if (!contentTypeRaw.startsWith('image/')) throw new Error(`unexpected content type ${contentTypeRaw}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (!bytes.byteLength || bytes.byteLength > MAX_CJ_IMAGE_BYTES) {
        throw new Error('image is empty or exceeds the 15 MB storage limit')
      }

      const extension = contentTypeRaw.includes('png')
        ? 'png'
        : contentTypeRaw.includes('webp')
          ? 'webp'
          : contentTypeRaw.includes('gif')
            ? 'gif'
            : contentTypeRaw.includes('avif')
              ? 'avif'
              : 'jpg'
      const digest = await shortSha256(sourceUrl)
      const safePid = String(cjProductId || 'product').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80)
      const objectPath = `${sellerProfileId}/product-images/supplyline/${safePid}/${digest}.${extension}`
      const { error: uploadError } = await client.storage
        .from('product-images')
        .upload(objectPath, bytes, { contentType: contentTypeRaw, upsert: true })
      if (uploadError) throw uploadError

      const { data: publicData } = client.storage.from('product-images').getPublicUrl(objectPath)
      const publicUrl = String(publicData?.publicUrl || '').trim()
      if (!publicUrl) throw new Error('storage returned no public image URL')
      cachedUrls.push(publicUrl)
      bySource.set(sourceUrl, publicUrl)
    } catch (error) {
      console.error('CJ image cache warning:', sourceUrl, String((error as any)?.message || error))
    }
  }

  if (requestedUrls.length && !cachedUrls.length) {
    throw new Error('CJ images were found but none could be cached without exposing the supplier source.')
  }
  return { urls: cachedUrls, bySource }
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
    markupType: 'percent' | 'flat'
    affiliateValue: number
    affiliateType: 'percent' | 'flat'
  },
  freightQuotes: NonNullable<ImportRequest['variantFreightQuotes']>,
  cachedImageBySource: Map<string, string>
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
  const freightQuoteByVid = new Map(
    freightQuotes.map((quote) => [String(quote?.vid || '').trim(), quote])
  )
  const now = new Date().toISOString()
  const normalizedRows = variants
    .map(variant => {
      if (!variant?.vid) return null
      const canonicalVariant = canonicalVariantById.get(String(variant.vid).trim()) || null
      const freightQuote = freightQuoteByVid.get(String(variant.vid).trim())
      if (!freightQuote) {
        throw new Error(`Live CJ freight quote missing for exact VID ${variant.vid}.`)
      }
      const supplierCost = parseCJPriceToUSD(variant.variantSellPrice ?? basePrice)
      const safeSupplierCost = Number.isFinite(supplierCost) && supplierCost > 0 ? supplierCost : basePrice
      const configuredMarkup = Math.max(0, Number(pricing.markup || 0))
      const sellerMarkup = pricing.markupType === 'flat'
        ? roundToTwo(configuredMarkup)
        : roundToTwo(safeSupplierCost * configuredMarkup / 100)
      const sellerPayout = roundToTwo(safeSupplierCost + sellerMarkup)
      const affiliatePayout = pricing.affiliateType === 'flat'
        ? roundToTwo(Math.max(0, Number(pricing.affiliateValue || 0)))
        : roundToTwo(sellerPayout * Math.max(0, Number(pricing.affiliateValue || 0)) / 100)
      const shippingReserve = roundToTwo(Math.max(0, Number(freightQuote.totalPostageFee || 0)))
      const fixedPricing = computeFixedTierPricing({
        supplierCost: safeSupplierCost,
        sellerMarkup,
        affiliatePayout,
        shippingIncluded: shippingReserve,
      })
      const retailPrice = fixedPricing.finalAdvertisedPrice
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
      const weightCandidate =
        (variant as any)?.variantWeight ??
        (variant as any)?.weight ??
        (variant as any)?.weightOz ??
        (variant as any)?.weight_oz ??
        (variant as any)?.variantWeightOz ??
        (variant as any)?.variantWeightG ??
        null
      const weightOz = toWeightOz(weightCandidate)
      const sourceImage = String(
        variant.variantImage ||
          (variant as any)?.variantBigImage ||
          (variant as any)?.variantImageUrl ||
          (variant as any)?.image ||
          (variant as any)?.bigImage ||
          ''
      ).trim()
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
        is_orderable: Boolean(canonicalVariant?.cj_vid),
        order_reference_type: 'cj_vid',
        raw_variant_payload_json: {},
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
        supplier_cost_amount: safeSupplierCost,
        seller_markup_amount: sellerMarkup,
        seller_payout_amount: sellerPayout,
        affiliate_payout_amount: affiliatePayout,
        shipping_reserve_amount: shippingReserve,
        calculated_customer_price: retailPrice,
        cj_freight_method: String(freightQuote.logisticName || '').trim(),
        cj_freight_origin_country: String(freightQuote.originCountryCode || '').trim().toUpperCase(),
        cj_freight_destination_country: String(freightQuote.destinationCountryCode || '').trim().toUpperCase(),
        cj_freight_quoted_at: String(freightQuote.quotedAt || now),
        cj_price_verified_at: now,
        compare_at_price: null,
        currency: 'USD',
        weight_oz: weightOz,
        image_url: (sourceImage ? cachedImageBySource.get(sourceImage) : null) || fallbackImage || null,
        attributes: parseVariantAttributes(variant),
        inventory,
        in_stock: hasKnownInventory ? inventory > 0 : true,
        inventory_policy: hasKnownInventory ? 'deny' : 'continue',
        inventory_source: 'cj',
        is_active: true,
        external_data: {
          supplyline_plus: true,
          shipping_display: {
            estimated_days: freightQuote.logisticAging || null,
            destination_country: freightQuote.destinationCountryCode,
          },
        },
        created_at: now,
        updated_at: now,
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  if (!normalizedRows.length) {
    return
  }

  const { data: savedVariants, error } = await client
    .from('product_variants')
    .upsert(normalizedRows as any[], { onConflict: 'cj_variant_id' })
    .select('id,cj_vid,cj_variant_id')

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
    throw error
  }

  const sourceVariantByVid = new Map(variants.map((variant) => [String(variant.vid || '').trim(), variant]))
  const privateMappings = ((savedVariants as any[]) || []).map((saved) => {
    const exactVid = String(saved?.cj_vid || '').trim()
    const sourceVariant = sourceVariantByVid.get(exactVid)
    const row = normalizedRows.find((candidate) => String(candidate?.cj_vid || '').trim() === exactVid)
    const quote = freightQuoteByVid.get(exactVid)
    if (!exactVid || !row || !quote) return null
    return {
      product_variant_id: saved.id,
      beezio_product_id: productId,
      cj_product_id: cjProductId,
      cj_vid: exactVid,
      cj_variant_sku: String(sourceVariant?.variantSku || '').trim() || null,
      supplier_cost_amount: row.supplier_cost_amount,
      origin_country_code: String(quote.originCountryCode || 'CN').trim().toUpperCase(),
      freight_method: String(quote.logisticName || '').trim() || null,
      freight_cost_amount: row.shipping_reserve_amount,
      freight_destination_country: String(quote.destinationCountryCode || 'US').trim().toUpperCase(),
      freight_quoted_at: String(quote.quotedAt || now),
      price_verified_at: now,
      raw_supplier_payload: sourceVariant || {},
      is_active: true,
      updated_at: now,
    }
  }).filter(Boolean)

  if (privateMappings.length) {
    const { error: privateMappingError } = await client
      .from('cj_variant_mappings')
      .upsert(privateMappings, { onConflict: 'product_variant_id' })
    if (privateMappingError) throw privateMappingError
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

const ensureSupplyLinePlusPlacement = async (
  client: any,
  ownerProfileId: string,
  productId: string
) => {
  const { data: existing, error: lookupError } = await client
    .from('storefronts')
    .select('id,owner_id,name,slug,is_active')
    .eq('slug', SUPPLYLINE_PLUS_SLUG)
    .maybeSingle()
  if (lookupError) throw lookupError

  let storefront = existing as any
  if (storefront) {
    if (String(storefront.owner_id || '').trim() !== ownerProfileId) {
      throw new Error(`${SUPPLYLINE_PLUS_NAME} is already owned by another Beezio profile.`)
    }
    const { data: updated, error: updateError } = await client
      .from('storefronts')
      .update({
        name: SUPPLYLINE_PLUS_NAME,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', storefront.id)
      .select('id,owner_id,name,slug,is_active')
      .single()
    if (updateError) throw updateError
    storefront = updated
  } else {
    const { data: inserted, error: insertError } = await client
      .from('storefronts')
      .insert({
        owner_id: ownerProfileId,
        type: 'seller',
        name: SUPPLYLINE_PLUS_NAME,
        slug: SUPPLYLINE_PLUS_SLUG,
        is_active: true,
      })
      .select('id,owner_id,name,slug,is_active')
      .single()
    if (insertError) throw insertError
    storefront = inserted
  }

  const { error: placementError } = await client
    .from('storefront_products')
    .upsert({
      storefront_id: storefront.id,
      product_id: productId,
      placement_source: 'supplyline_plus',
      source_owner_id: ownerProfileId,
    }, { onConflict: 'storefront_id,product_id' })
  if (placementError) throw placementError

  return storefront
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

    // Authenticated user client (to validate the caller). The only non-user
    // path is a server-to-server SupplyLine seed request authenticated with the
    // Supabase service-role JWT plus an explicit internal-purpose header.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'Missing Authorization header' })

    const usingServiceRole = Boolean(serviceRoleKey)
    // Prefer service_role for inserts (bypasses RLS). If missing, fall back to anon+JWT (RLS enforced).
    const supabaseAdmin = usingServiceRole
      ? createClient(supabaseUrl, serviceRoleKey)
      : createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })

    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
    const isInternalSupplyLineImport = Boolean(
      serviceRoleKey &&
      bearerToken === serviceRoleKey &&
      req.headers.get('X-Beezio-Internal-Import') === 'supplyline-plus'
    )

    let internalOwnerProfileId: string | null = null
    let user: any = null
    if (isInternalSupplyLineImport) {
      const { data: storefront, error: storefrontError } = await supabaseAdmin
        .from('storefronts')
        .select('owner_id')
        .eq('slug', SUPPLYLINE_PLUS_SLUG)
        .eq('is_active', true)
        .maybeSingle()
      if (storefrontError || !(storefront as any)?.owner_id) {
        return json(503, { error: `${SUPPLYLINE_PLUS_NAME} owner is not configured.` })
      }
      internalOwnerProfileId = String((storefront as any).owner_id)
      const { data: ownerProfile, error: ownerError } = await supabaseAdmin
        .from('profiles')
        .select('id,user_id,email,full_name')
        .eq('id', internalOwnerProfileId)
        .maybeSingle()
      if (ownerError || !ownerProfile) {
        return json(503, { error: `${SUPPLYLINE_PLUS_NAME} owner profile is unavailable.` })
      }
      user = {
        id: String((ownerProfile as any).user_id || (ownerProfile as any).id),
        email: (ownerProfile as any).email || null,
        user_metadata: { full_name: (ownerProfile as any).full_name || '' },
      }
    } else {
      const supabaseAuthed = createClient(supabaseUrl, anonKey || serviceRoleKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: userData, error: userError } = await supabaseAuthed.auth.getUser()
      if (userError || !userData?.user) {
        return json(401, { error: 'Unauthorized', details: userError?.message })
      }
      user = userData.user
    }

    const email = (user.email || '').toLowerCase()
    const body = (await req.json()) as ImportRequest

    // Admin-only by email fallback (matches UI gate); also allow DB role=admin.

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
    let isAllowed = isInternalSupplyLineImport || emailWhitelisted
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
    let sellerProfileId: string | null = internalOwnerProfileId
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

    const pricing = body?.pricing || { markup: 10, affiliateCommission: 5 }
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
    const freightQuotes = (Array.isArray(body?.variantFreightQuotes) ? body.variantFreightQuotes : [])
      .map((quote) => ({
        ...quote,
        vid: String(quote?.vid || '').trim(),
        originCountryCode: String(quote?.originCountryCode || '').trim().toUpperCase(),
        destinationCountryCode: String(quote?.destinationCountryCode || '').trim().toUpperCase(),
        logisticName: String(quote?.logisticName || '').trim(),
        totalPostageFee: roundToTwo(Number(quote?.totalPostageFee || 0)),
        quotedAt: String(quote?.quotedAt || '').trim(),
      }))
    const freightQuoteByVid = new Map(freightQuotes.map((quote) => [quote.vid, quote]))
    const missingFreightVids = variants
      .map((variant) => String(variant?.vid || '').trim())
      .filter((vid) => !vid || !freightQuoteByVid.has(vid))
    if (!variants.length || missingFreightVids.length) {
      return json(400, {
        error: 'Every imported variant requires a live CJ freight quote for its exact VID.',
        missingVids: missingFreightVids,
      })
    }
    for (const quote of freightQuotes) {
      const quotedAtMs = Date.parse(quote.quotedAt)
      if (
        !quote.vid ||
        !quote.originCountryCode ||
        !quote.destinationCountryCode ||
        !quote.logisticName ||
        !(quote.totalPostageFee > 0) ||
        !Number.isFinite(quotedAtMs) ||
        Date.now() - quotedAtMs > 2 * 60 * 60 * 1000
      ) {
        return json(400, { error: `Invalid or stale live freight quote for exact VID ${quote.vid || 'unknown'}.` })
      }
    }

    const shippingOptions = freightQuotes.map((quote) => ({
      name: quote.logisticName,
      cost: quote.totalPostageFee,
      estimated_days: String(quote.logisticAging || ''),
      origin_country: quote.originCountryCode,
      destination_country: quote.destinationCountryCode,
      tracking_supported: true,
      vid: quote.vid,
    }))
    const shippingCostResolved = Math.max(...freightQuotes.map((quote) => quote.totalPostageFee))
    const customerFacingShippingOptions = shippingOptions.map((option) => ({
      name: option.name,
      cost: 0,
      estimated_days: option.estimated_days,
      origin_country: option.origin_country,
      destination_country: option.destination_country,
      tracking_supported: true,
    }))
    const customerFacingShippingCost = 0
    const sourceVideos = extractVideosFromCjPayload(
      detailed,
      variants,
      Array.isArray((body as any)?.videos) ? (body as any).videos : []
    )
    const videos = await cacheCjVideos(
      supabaseAdmin,
      sellerProfileId,
      String(cjProduct.pid || '').trim(),
      sourceVideos
    )
    const originTag = String(shippingOptions[0]?.origin_label || shippingOptions[0]?.origin_country || '').trim()
    const importTags = uniqueStrings([
      ...(originTag ? [`Ships from: ${originTag}`] : []),
      ...(String((detailed as any)?.brandName || (detailed as any)?.brand || '').trim()
        ? [`Brand: ${String((detailed as any)?.brandName || (detailed as any)?.brand || '').trim()}`]
        : []),
      SUPPLYLINE_PLUS_NAME,
    ])
    const beezioCategory = String(body?.beezioCategory || '').trim() || null

    // Compute pricing server-side to avoid client/UI drift.
    const variantCosts = variants
      .map((variant) => parseCJPriceToUSD((variant as any)?.variantSellPrice))
      .filter((cost) => cost > 0)
    const cjUnitCost = variantCosts.length
      ? Math.max(...variantCosts)
      : parseCJPriceToUSD((cjProduct as any).sellPrice)
    const markup = Number(pricing?.markup ?? 0)
    const markupTypeRaw = String(pricing?.markupType || 'flat').toLowerCase()
    const markupType: 'percent' | 'flat' = markupTypeRaw === 'flat' ? 'flat' : 'percent'
    const affiliateValue = Number(pricing?.affiliateCommission ?? 0)
    const affiliateTypeRaw = String(pricing?.affiliateCommissionType || 'flat').toLowerCase()
    const affiliateType: 'percent' | 'flat' = affiliateTypeRaw === 'flat' ? 'flat' : 'percent'
    const platformFeeValue = Number(pricing?.platformFee ?? NaN)
    const safeCjUnitCost = Number.isFinite(cjUnitCost) && cjUnitCost > 0 ? cjUnitCost : 0
    const safeMarkup = Number.isFinite(markup) && markup >= 0 ? markup : 0
    const safeAffiliateValue = Number.isFinite(affiliateValue) && affiliateValue >= 0 ? affiliateValue : 0
    void platformFeeValue

    const sellerMarkup = markupType === 'flat'
      ? safeMarkup
      : roundToTwo(safeCjUnitCost * safeMarkup / 100)
    const sellerAsk = roundToTwo(safeCjUnitCost + sellerMarkup)
    const affiliateAmount = affiliateType === 'flat'
      ? roundToTwo(safeAffiliateValue)
      : roundToTwo(sellerAsk * safeAffiliateValue / 100)
    const fixedPricing = computeFixedTierPricing({
      supplierCost: safeCjUnitCost,
      sellerMarkup,
      affiliatePayout: affiliateAmount,
      shippingIncluded: shippingCostResolved,
    })
    const influencerBonusPool = fixedPricing.influencerAllocation
    const basePlatformAmount = fixedPricing.platformFee
    const platformAmount = fixedPricing.platformFee
    const finalPrice = fixedPricing.finalAdvertisedPrice
    const samplePrice = calculateSamplePriceFromCost(safeCjUnitCost + shippingCostResolved)
    const sampleEnabled = samplePrice > 0

    if (!Number.isFinite(finalPrice) || finalPrice <= 0 || !Number.isFinite(sellerAsk) || sellerAsk <= 0) {
      return json(400, {
        error: 'Invalid pricing inputs',
        details: { cjCost: (cjProduct as any).sellPrice, normalizedCjCost: cjUnitCost, shippingCostResolved, markup: pricing?.markup, markupType, affiliateCommission: pricing?.affiliateCommission, affiliateType },
      })
    }

    const sourceImages = (() => {
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
    const cachedImages = await cacheCjImages(
      supabaseAdmin,
      sellerProfileId,
      String(cjProduct.pid || '').trim(),
      sourceImages
    )
    const normalizedImages = cachedImages.urls

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
        return String(normalizedCj.title || cjProduct.productNameEn).trim()
      })(),
      source: 'cj',
      cj_product_id: normalizedCj.cj_product_id || String(cjProduct.pid || '').trim() || null,
      cj_pid: normalizedCj.cj_pid,
      cj_product_code: normalizedCj.cj_product_code,
      cj_product_sku: normalizedCj.cj_product_sku,
      cj_spu: normalizedCj.cj_spu,
      cj_name_raw: normalizedCj.cj_name_raw,
      cj_source_payload_json: {},
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
      supplier_cost_amount: safeCjUnitCost,
      seller_markup_amount: sellerMarkup,
      affiliate_payout_amount: affiliateAmount,
      shipping_reserve_amount: shippingCostResolved,
      influencer_allocation_amount: fixedPricing.influencerAllocation,
      paypal_processing_allowance: fixedPricing.paypalProcessingAllowance,
      platform_fee: platformAmount,
      currency: 'USD',
      base_weight_oz: baseWeightOz,
      image_url: normalizedImages[0] ?? cjProduct.productImage,
      images: normalizedImages,
      sku: resolvedProductSku,
      // Exact supplier variant payloads stay in private mapping tables. Public
      // clients load the sanitized product_variants projection instead.
      variants: null,
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
      stock_quantity: productStockQuantity,
      total_inventory: productStockQuantity,
      in_stock: hasKnownInventory ? productStockQuantity > 0 : true,
      inventory_source: 'cj',
      dropship_provider: 'cj',
      is_dropshipped: true,
      product_type: 'one_time',
      lineage: SUPPLYLINE_PLUS_NAME,
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
    const variantBasePrice = safeCjUnitCost > 0 ? safeCjUnitCost : parseCJPriceToUSD(cjProduct.sellPrice)

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
          markupType,
          affiliateValue: safeAffiliateValue,
          affiliateType,
        },
        freightQuotes,
        cachedImages.bySource
      )
    } catch (variantError) {
      await supabaseAdmin
        .from('products')
        .update({ is_active: false, status: 'draft', import_status: 'needs_review', updated_at: new Date().toISOString() })
        .eq('id', product.id)
      throw new Error(`Variant import failed: ${String((variantError as any)?.message || variantError)}`)
    }

    try {
      await upsertDefaultShippingOption(supabaseAdmin, product.id, shippingCostResolved)
    } catch (shippingError) {
      console.error('Default shipping option sync warning:', shippingError)
    }

    const mappingProductId = normalizedCj.cj_product_id || cjProduct.pid
    const mappingVariantId = selectedCanonicalVariant?.cj_vid || selectedCanonicalVariant?.cj_variant_id || null
    let existingMappingPriceBreakdown: Record<string, unknown> = {}
    try {
      let existingMappingQuery = supabaseAdmin
        .from('cj_product_mappings')
        .select('price_breakdown')
        .eq('cj_product_id', mappingProductId)
      existingMappingQuery = mappingVariantId
        ? existingMappingQuery.eq('cj_variant_id', mappingVariantId)
        : existingMappingQuery.is('cj_variant_id', null)
      const { data: existingMapping } = await existingMappingQuery.maybeSingle()
      if (
        (existingMapping as any)?.price_breakdown &&
        typeof (existingMapping as any).price_breakdown === 'object'
      ) {
        existingMappingPriceBreakdown = (existingMapping as any).price_breakdown
      }
    } catch {
      existingMappingPriceBreakdown = {}
    }

    const { error: mappingError } = await supabaseAdmin
      .from('cj_product_mappings')
      .upsert({
        beezio_product_id: product.id,
        cj_product_id: mappingProductId,
        cj_product_sku: normalizedCj.cj_product_sku || normalizedCj.cj_product_code || normalizedCj.cj_spu,
        cj_variant_id: mappingVariantId,
        cj_cost: safeCjUnitCost,
        markup_percent: pricing.markup,
        affiliate_commission_percent: affiliateType === 'flat' ? 0 : safeAffiliateValue,
        price_breakdown: {
          ...existingMappingPriceBreakdown,
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
          selectedVariant: selectedVariant ? {
            vid: (selectedVariant as any)?.vid,
            variantSku: (selectedVariant as any)?.variantSku,
            variantNameEn: (selectedVariant as any)?.variantNameEn,
            variantSellPrice: (selectedVariant as any)?.variantSellPrice,
          } : null,
          inventory: resolvedInventory,
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
      await supabaseAdmin
        .from('products')
        .update({ is_active: false, status: 'draft', import_status: 'needs_review', updated_at: new Date().toISOString() })
        .eq('id', product.id)
      throw new Error(`Private SupplyLine mapping failed: ${mappingError.message}`)
    }

    let supplyLineStorefront: any = null
    try {
      supplyLineStorefront = await ensureSupplyLinePlusPlacement(
        supabaseAdmin,
        sellerProfileId,
        product.id
      )
    } catch (placementError) {
      await supabaseAdmin
        .from('products')
        .update({ is_active: false, status: 'draft', import_status: 'needs_review', updated_at: new Date().toISOString() })
        .eq('id', product.id)
      throw new Error(`SupplyLine Plus placement failed: ${String((placementError as any)?.message || placementError)}`)
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
      storefront: supplyLineStorefront,
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
