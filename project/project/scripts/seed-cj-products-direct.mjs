import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(projectRoot, '.env.local'));
loadEnvFile(path.join(projectRoot, '.env'));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CJ_PROXY_URL = process.env.CJ_PROXY_URL || 'https://beezio.co/.netlify/functions/cj-proxy';
const SELLER_EMAIL = process.env.CJ_SEED_SELLER_EMAIL || 'jason@beezio.co';
const INPUT_SKUS = process.argv.slice(2).map((value) => String(value || '').trim()).filter(Boolean);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase env. Expected SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

if (!INPUT_SKUS.length) {
  throw new Error('Provide one or more CJ SKUs. Example: node scripts/seed-cj-products-direct.mjs CJJT2473291');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const roundToTwo = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

function firstNonEmptyString(...values) {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function extractImageUrls(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractImageUrls(entry));
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];
    if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('{') && raw.endsWith('}'))) {
      try {
        return extractImageUrls(JSON.parse(raw));
      } catch {
      }
    }
    if (raw.includes(',')) {
      return raw.split(',').map((part) => part.trim()).filter(Boolean);
    }
    return [raw];
  }
  if (typeof value === 'object') {
    const candidate = value.url ?? value.image ?? value.src ?? value.productImage ?? value.bigImage ?? '';
    return candidate ? [String(candidate).trim()].filter(Boolean) : [];
  }
  return [];
}

function normalizeVideoUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('//')) return `https:${raw}`;
  return raw;
}

function extractVideoUrls(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((entry) => extractVideoUrls(entry));
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];
    if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('{') && raw.endsWith('}'))) {
      try {
        return extractVideoUrls(JSON.parse(raw));
      } catch {
      }
    }
    if (raw.includes(',')) {
      return raw.split(',').map((part) => normalizeVideoUrl(part)).filter(Boolean);
    }
    return [normalizeVideoUrl(raw)].filter(Boolean);
  }
  if (typeof value === 'object') {
    const candidate = value.videoUrl ?? value.video_url ?? value.url ?? value.video ?? value.src ?? '';
    return candidate ? [normalizeVideoUrl(candidate)].filter(Boolean) : [];
  }
  return [];
}

function uniqueStrings(values) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const normalized = String(value ?? '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function decodeEntities(input) {
  return String(input || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const n = parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCharCode(n) : '';
    });
}

function sanitizeImportedDescription(raw) {
  const decoded = decodeEntities(String(raw || ''));
  const stripped = decoded
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\bwww\.[^\s]+/gi, ' ')
    .replace(/cj\s*dropshipping/gi, ' ')
    .replace(/cjdropshipping/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped;
}

function parseCJPriceToUSD(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (Number.isInteger(value) && value >= 1000 && value <= 1000000) {
      return roundToTwo(value / 100);
    }
    return roundToTwo(value);
  }
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const matches = raw.match(/-?\d+(?:\.\d+)?/g) || [];
  const normalized = matches
    .map((token) => {
      const parsed = Number(token);
      if (!Number.isFinite(parsed) || parsed <= 0) return null;
      if (!token.includes('.') && Number.isInteger(parsed) && parsed >= 1000 && parsed <= 1000000) {
        return roundToTwo(parsed / 100);
      }
      return roundToTwo(parsed);
    })
    .filter((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry > 0);
  return normalized.length ? Math.max(...normalized) : 0;
}

function buildImages(detail, fallbackSingleImage = '') {
  const variantRows = Array.isArray(detail?.variants)
    ? detail.variants
    : Array.isArray(detail?.variantList)
      ? detail.variantList
      : Array.isArray(detail?.productVariantList)
        ? detail.productVariantList
        : [];
  return uniqueStrings([
    ...extractImageUrls(fallbackSingleImage),
    ...extractImageUrls(detail?.productImage),
    ...extractImageUrls(detail?.bigImage),
    ...extractImageUrls(detail?.productImageList),
    ...extractImageUrls(detail?.images),
    ...extractImageUrls(detail?.imageList),
    ...variantRows.flatMap((variant) => [
      variant?.variantImage,
      variant?.variantImageUrl,
      variant?.variantBigImage,
      variant?.image,
      variant?.bigImage,
      ...extractImageUrls(variant?.variantImageList),
      ...extractImageUrls(variant?.images),
      ...extractImageUrls(variant?.imageList),
    ]),
  ]).slice(0, 20);
}

function buildVideos(detail, variants = []) {
  return uniqueStrings([
    ...extractVideoUrls(detail?.productVideoList),
    ...extractVideoUrls(detail?.videoList),
    ...extractVideoUrls(detail?.videos),
    ...extractVideoUrls(detail?.productVideo),
    ...extractVideoUrls(detail?.productVideoUrl),
    ...extractVideoUrls(detail?.videoUrl),
    ...variants.flatMap((variant) => [
      ...extractVideoUrls(variant?.videoUrl),
      ...extractVideoUrls(variant?.video),
      ...extractVideoUrls(variant?.videos),
    ]),
  ]).slice(0, 12);
}

function extractProductRows(payload) {
  const direct = [payload, payload?.data].flatMap((source) => [
    ...(Array.isArray(source) ? source : []),
    ...(Array.isArray(source?.list) ? source.list : []),
    ...(Array.isArray(source?.content) ? source.content : []),
    ...(Array.isArray(source?.records) ? source.records : []),
    ...(Array.isArray(source?.rows) ? source.rows : []),
    ...(Array.isArray(source?.productList) ? source.productList : []),
  ]);

  const nested = [payload, payload?.data].flatMap((source) =>
    Array.isArray(source?.content)
      ? source.content.flatMap((entry) => (Array.isArray(entry?.productList) ? entry.productList : []))
      : []
  );

  return [...direct, ...nested].filter((row) => row && typeof row === 'object');
}

async function cjRequest(endpoint, body = {}, method = 'GET') {
  const response = await fetch(CJ_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, body, method }),
  });
  const raw = await response.text();
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`CJ proxy returned non-JSON for ${endpoint}: ${raw.slice(0, 160)}`);
  }
  if (!response.ok) {
    throw new Error(json.error || json.details || `CJ proxy failed for ${endpoint} (${response.status})`);
  }
  if (json && json.result === false) {
    throw new Error(json.message || `CJ API error for ${endpoint}`);
  }
  return json;
}

async function findCjProductBySku(inputSku) {
  const normalized = String(inputSku || '').trim().toUpperCase();
  const attempts = [
    { endpoint: 'product/list', method: 'GET', body: { pageNum: 1, pageSize: 20, productSku: normalized } },
    { endpoint: 'product/list', method: 'GET', body: { pageNum: 1, pageSize: 20, sku: normalized } },
    { endpoint: 'product/list', method: 'GET', body: { pageNum: 1, pageSize: 20, productSpu: normalized } },
    { endpoint: 'product/list', method: 'GET', body: { pageNum: 1, pageSize: 20, spu: normalized } },
    { endpoint: 'product/list', method: 'GET', body: { pageNum: 1, pageSize: 20, keyword: normalized } },
    { endpoint: 'product/listV2', method: 'GET', body: { page: 1, size: 20, keyword: normalized } },
  ];

  for (const attempt of attempts) {
    try {
      const response = await cjRequest(attempt.endpoint, attempt.body, attempt.method);
      const rows = extractProductRows(response?.data ?? response);
      const exact = rows.find((row) => {
        const sku = firstNonEmptyString(row?.productSku, row?.sku, row?.productCode, row?.productCodeEn).toUpperCase();
        const spu = firstNonEmptyString(row?.productSpu, row?.spu, row?.spuCode, row?.spuId).toUpperCase();
        return sku === normalized || spu === normalized;
      });
      if (exact) return exact;
      if (rows[0]) return rows[0];
    } catch {
    }
  }

  return null;
}

async function loadCjDetail(pid) {
  const response = await cjRequest('product/query', { pid }, 'GET');
  const data = response?.data ?? response;
  if (Array.isArray(data)) {
    return data.find((row) => String(row?.pid ?? row?.id ?? row?.productId ?? '') === String(pid)) || data[0] || null;
  }
  if (Array.isArray(data?.list)) {
    return data.list.find((row) => String(row?.pid ?? row?.id ?? row?.productId ?? '') === String(pid)) || data.list[0] || data;
  }
  return data;
}

function parseVariantAttributes(variant) {
  const attributes = {};
  const source = [variant?.variantKey, variant?.variantNameEn, variant?.variantName]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('|');
  const parts = source.split(/[|,;\/]+/).map((part) => part.trim()).filter(Boolean);
  let looseIndex = 1;
  for (const part of parts) {
    const separatorIndex = part.search(/[:=]/);
    if (separatorIndex >= 0) {
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (key && value) {
        attributes[key] = value;
        continue;
      }
    }
    attributes[`Variant Option ${looseIndex}`] = part;
    looseIndex += 1;
  }
  if (!Object.keys(attributes).length && variant?.variantNameEn) {
    attributes.Variant = String(variant.variantNameEn);
  }
  return attributes;
}

function parseOptionTriplet(attributes) {
  const entries = Object.entries(attributes || {}).slice(0, 3);
  const out = {};
  entries.forEach(([key, value], index) => {
    out[`option${index + 1}_name`] = String(key);
    out[`option${index + 1}_value`] = String(value);
  });
  return out;
}

async function upsertWithHealing(table, payload, options = {}) {
  let working = Array.isArray(payload) ? payload.map((row) => ({ ...row })) : { ...payload };
  const maxAttempts = 12;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let query = supabase.from(table).upsert(working, options);
    if (!Array.isArray(working)) {
      query = query.select().single();
    }
    const { data, error } = await query;
    if (!error) return { data, payload: working };

    const message = String(error.message || '');
    const missingMatch = message.match(/Could not find the ['"]([^'"]+)['"] column/i);
    const unknownKey = missingMatch?.[1];
    if (unknownKey) {
      if (Array.isArray(working)) {
        working = working.map((row) => {
          const next = { ...row };
          for (const key of Object.keys(next)) {
            if (key.toLowerCase() === unknownKey.toLowerCase()) delete next[key];
          }
          return next;
        });
      } else {
        for (const key of Object.keys(working)) {
          if (key.toLowerCase() === unknownKey.toLowerCase()) delete working[key];
        }
      }
      continue;
    }

    if (table === 'cj_product_mappings' && /relation .* does not exist/i.test(message)) {
      return { data: null, payload: working, ignored: true };
    }

    throw error;
  }

  throw new Error(`Failed to upsert ${table} after schema healing attempts.`);
}

async function insertWithHealing(table, payload, options = {}) {
  let working = Array.isArray(payload) ? payload.map((row) => ({ ...row })) : { ...payload };
  const maxAttempts = 12;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let query = supabase.from(table).insert(working, options);
    if (!Array.isArray(working) && !options.skipSelect) {
      query = query.select().single();
    }
    const { data, error } = await query;
    if (!error) return { data, payload: working };

    const message = String(error.message || '');
    const missingMatch = message.match(/Could not find the ['"]([^'"]+)['"] column/i);
    const unknownKey = missingMatch?.[1];
    if (unknownKey) {
      if (Array.isArray(working)) {
        working = working.map((row) => {
          const next = { ...row };
          for (const key of Object.keys(next)) {
            if (key.toLowerCase() === unknownKey.toLowerCase()) delete next[key];
          }
          return next;
        });
      } else {
        for (const key of Object.keys(working)) {
          if (key.toLowerCase() === unknownKey.toLowerCase()) delete working[key];
        }
      }
      continue;
    }

    if (/duplicate key value/i.test(message)) {
      return { data: null, payload: working, duplicate: true };
    }

    if ((table === 'cj_product_mappings' || table === 'shipping_options' || table === 'cj_products') && /relation .* does not exist/i.test(message)) {
      return { data: null, payload: working, ignored: true };
    }

    throw error;
  }

  throw new Error(`Failed to insert ${table} after schema healing attempts.`);
}

async function updateWithHealing(table, payload, match) {
  let working = { ...payload };
  const maxAttempts = 12;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let query = supabase.from(table).update(working);
    for (const [key, value] of Object.entries(match || {})) {
      query = query.eq(key, value);
    }
    query = query.select().single();
    const { data, error } = await query;
    if (!error) return { data, payload: working };

    const message = String(error.message || '');
    const missingMatch = message.match(/Could not find the ['"]([^'"]+)['"] column/i);
    const unknownKey = missingMatch?.[1];
    if (unknownKey) {
      for (const key of Object.keys(working)) {
        if (key.toLowerCase() === unknownKey.toLowerCase()) delete working[key];
      }
      continue;
    }

    throw error;
  }

  throw new Error(`Failed to update ${table} after schema healing attempts.`);
}

async function findExistingRow(table, match) {
  let query = supabase.from(table).select('id');
  for (const [key, value] of Object.entries(match || {})) {
    query = query.eq(key, value);
  }
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    const message = String(error.message || '');
    if (/Could not find the ['"]([^'"]+)['"] column/i.test(message)) return null;
    if (/relation .* does not exist/i.test(message)) return null;
    throw error;
  }
  return data || null;
}

async function manualUpsertByMatch(table, payload, match) {
  const existing = await findExistingRow(table, match);
  if (existing?.id) {
    return updateWithHealing(table, payload, { id: existing.id });
  }
  return insertWithHealing(table, payload);
}

async function resolveSellerProfile(email) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,user_id,email,role,primary_role')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Seller profile not found for ${email}`);
  return data;
}

async function seedSku(sellerProfile, inputSku) {
  const summary = { inputSku, status: 'pending' };
  const listRow = await findCjProductBySku(inputSku);
  if (!listRow) {
    summary.status = 'not_found';
    return summary;
  }

  const pid = firstNonEmptyString(listRow?.pid, listRow?.id, listRow?.productId, listRow?.product_id);
  const detail = await loadCjDetail(pid);
  if (!detail) {
    summary.status = 'detail_missing';
    summary.pid = pid;
    return summary;
  }

  const productSku = firstNonEmptyString(detail?.productSku, detail?.sku, listRow?.productSku, listRow?.sku, inputSku).toUpperCase();
  const productSpu = firstNonEmptyString(detail?.productSpu, detail?.spu, listRow?.productSpu, listRow?.spu).toUpperCase();
  const title = firstNonEmptyString(detail?.productNameEn, detail?.nameEn, detail?.productName, detail?.name, listRow?.productNameEn, inputSku);
  const description = sanitizeImportedDescription(detail?.description || detail?.productDescription || detail?.remark || detail?.detail || '');
  const variants = Array.isArray(detail?.variants)
    ? detail.variants
    : Array.isArray(detail?.variantList)
      ? detail.variantList
      : Array.isArray(detail?.productVariantList)
        ? detail.productVariantList
        : [];
  const images = buildImages(detail, firstNonEmptyString(detail?.productImage, listRow?.productImage, listRow?.bigImage));
  const videos = buildVideos(detail, variants);
  const baseUnitPrice = parseCJPriceToUSD(detail?.sellPrice ?? detail?.price ?? listRow?.sellPrice);
  const customerPrice = roundToTwo(baseUnitPrice);
  const shippingOptions = [
    {
      name: 'Free Shipping',
      price: 0,
      estimated_days: '5-12 business days',
      provider: 'CJ',
      included_in_price: true,
      destination_country: 'US',
    },
  ];
  const now = new Date().toISOString();

  const productPayload = {
    seller_id: sellerProfile.id,
    title,
    description: description || title,
    price: customerPrice,
    calculated_customer_price: customerPrice,
    seller_ask: customerPrice,
    seller_amount: customerPrice,
    seller_ask_price: customerPrice,
    currency: 'USD',
    cj_product_id: pid,
    external_id: pid,
    primary_image_url: images[0] || null,
    image_url: images[0] || null,
    images,
    videos,
    video_url: videos[0] || '',
    tags: uniqueStrings(['CJ', 'CJ Dropshipping', productSku, productSpu, String(detail?.categoryName || listRow?.categoryName || '').trim()]).slice(0, 12),
    shipping_cost: 0,
    shipping_price: 0,
    shipping_options: shippingOptions,
    requires_shipping: true,
    commission_rate: 0,
    commission_type: 'percentage',
    flat_commission_amount: 0,
    affiliate_enabled: true,
    affiliate_commission_type: 'percent',
    affiliate_commission_value: 0,
    track_inventory: false,
    stock_quantity: 0,
    total_inventory: 0,
    in_stock: true,
    inventory_source: 'cj',
    source_platform: 'cj',
    dropship_provider: 'cj',
    lineage: 'CJ',
    is_dropshipped: true,
    is_promotable: true,
    is_active: true,
    status: 'active',
    has_variants: variants.length > 0,
    base_cost_cents: Math.round(customerPrice * 100),
    retail_price_cents: Math.round(customerPrice * 100),
    shipping_estimate_cents: 0,
    api_integration: {
      enabled: true,
      supplier: 'CJdropshipping',
      supplier_product_id: pid,
      supplier_sku: productSku || null,
      supplier_spu: productSpu || null,
      supplier_cost: customerPrice,
      supplier_shipping_cost: 0,
      shipping_included_in_price: true,
      raw_product: detail,
    },
    created_at: now,
    updated_at: now,
  };

  const { data: product } = await manualUpsertByMatch('products', productPayload, { cj_product_id: pid });

  await updateWithHealing('products', {
    is_active: true,
    status: 'active',
    images,
    videos,
    shipping_cost: 0,
    track_inventory: false,
    in_stock: true,
    total_inventory: 0,
    stock_quantity: 0,
  }, { id: product.id });

  await updateWithHealing('products', {
    is_active: true,
    in_stock: true,
  }, { id: product.id });

  await insertWithHealing('cj_products', {
    cj_product_id: pid,
    raw_json: detail,
    imported_at: now,
  }, { skipSelect: true });

  if (Array.isArray(variants) && variants.length) {
    const variantRows = variants
      .map((variant) => {
        const vid = firstNonEmptyString(variant?.vid, variant?.id, variant?.variantId, variant?.skuId);
        if (!vid) return null;
        const sku = firstNonEmptyString(variant?.variantSku, variant?.sku, `${productSku}-${vid}`);
        const variantPrice = roundToTwo(parseCJPriceToUSD(variant?.variantSellPrice ?? variant?.sellPrice ?? variant?.price) || customerPrice);
        const attributes = parseVariantAttributes(variant);
        return {
          product_id: product.id,
          provider: 'CJ',
          source_platform: 'cj',
          cj_product_id: pid,
          cj_variant_id: vid,
          external_product_id: pid,
          external_variant_id: vid,
          sku,
          price: variantPrice,
          compare_at_price: null,
          currency: 'USD',
          image_url: firstNonEmptyString(variant?.variantImage, variant?.variantImageUrl, variant?.variantBigImage, variant?.image, images[0]),
          attributes,
          inventory: 0,
          is_active: true,
          cost_cents: Math.round(variantPrice * 100),
          retail_price_cents: Math.round(variantPrice * 100),
          inventory_policy: 'continue',
          in_stock: true,
          inventory_source: 'cj',
          external_data: {
            raw_variant: variant,
            shipping_options: [],
          },
          created_at: now,
          updated_at: now,
          ...parseOptionTriplet(attributes),
        };
      })
      .filter(Boolean);

    if (variantRows.length) {
      for (const row of variantRows) {
        await manualUpsertByMatch('product_variants', row, { cj_variant_id: row.cj_variant_id });
      }
    }
  }

  await manualUpsertByMatch('shipping_options', {
    product_id: product.id,
    variant_id: null,
    provider: 'CJ',
    destination_country: 'US',
    method_code: 'CJ_FREE',
    method_name: 'Free shipping',
    cost: 0,
    min_days: 5,
    max_days: 12,
    processing_days: null,
    last_quoted_at: now,
    created_at: now,
    updated_at: now,
  }, {
    product_id: product.id,
    destination_country: 'US',
    method_code: 'CJ_FREE',
  });

  await insertWithHealing('cj_product_mappings', {
    beezio_product_id: product.id,
    product_id: product.id,
    cj_product_id: pid,
    cj_product_sku: productSku || inputSku,
    cj_variant_id: Array.isArray(variants) && variants[0] ? firstNonEmptyString(variants[0]?.vid, variants[0]?.id, variants[0]?.variantId) || null : null,
    cj_cost: customerPrice,
    markup_percent: 0,
    affiliate_commission_percent: 0,
    price_breakdown: {
      direct_seed: true,
      seller_controls_pricing: true,
      storefront_shipping: 0,
      customer_price: customerPrice,
    },
    last_synced: now,
  }, { skipSelect: true });

  const videoCount = videos.length;
  const imageCount = images.length;
  summary.status = 'seeded';
  summary.pid = pid;
  summary.productId = product.id;
  summary.productSku = productSku;
  summary.productSpu = productSpu || null;
  summary.title = title;
  summary.images = imageCount;
  summary.videos = videoCount;
  summary.variants = Array.isArray(variants) ? variants.length : 0;
  return summary;
}

async function main() {
  const sellerProfile = await resolveSellerProfile(SELLER_EMAIL);
  const results = [];
  for (const sku of INPUT_SKUS) {
    try {
      const result = await seedSku(sellerProfile, sku);
      results.push(result);
    } catch (error) {
      results.push({
        inputSku: sku,
        status: 'failed',
        error: String(error?.message || error),
      });
    }
  }

  console.log(JSON.stringify({
    seller: {
      id: sellerProfile.id,
      email: sellerProfile.email,
    },
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
