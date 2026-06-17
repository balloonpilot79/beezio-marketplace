import { supabaseUrl } from '../lib/supabase';

const PRODUCT_BUCKET = 'product-images';
const PUBLIC_BUCKET_BASE = `${supabaseUrl}/storage/v1/object/public/${PRODUCT_BUCKET}`;

const FALLBACK_PRODUCT_IMAGES = [
  'https://images.unsplash.com/photo-1513708927688-2f8c4412ff33?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1455849318743-b2233052fcff?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80',
];

const EXTERNAL_URL_REGEX = /^(https?:|data:|blob:)/i;

const tryDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const extractFirstStringFromJson = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const extracted = extractFirstStringFromJson(entry);
      if (extracted) return extracted;
    }
    return null;
  }
  if (typeof value === 'object') {
    const candidate =
      (value as any).image_url ||
      (value as any).url ||
      (value as any).src ||
      (value as any).path ||
      null;
    return typeof candidate === 'string' ? candidate : null;
  }
  return null;
};

const resolveJsonEncodedImageString = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Handle URL-encoded JSON like %5B%22https...%22%5D
  const decoded = /%5B|%7B|%22/i.test(trimmed) ? tryDecodeURIComponent(trimmed) : trimmed;
  const decodedTrimmed = decoded.trim();

  if (!decodedTrimmed.startsWith('[') && !decodedTrimmed.startsWith('{')) return null;

  try {
    const parsed = JSON.parse(decodedTrimmed);
    const candidate = extractFirstStringFromJson(parsed);
    return typeof candidate === 'string' ? candidate.trim() : null;
  } catch {
    return null;
  }
};

const seedToIndex = (seed?: string) => {
  if (!seed) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0; // Force 32bit int
  }
  return Math.abs(hash) % FALLBACK_PRODUCT_IMAGES.length;
};

export const normalizeProductImagePath = (imageUrl?: string | null): string | null => {
  if (!imageUrl) return null;

  const trimmed = imageUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/api/placeholder') || trimmed.startsWith('api/placeholder')) return null;

  // Some rows store images as JSON or URL-encoded JSON (e.g. '["https://..."]' or '%5B%22https...%22%5D').
  // If we treat that as a storage path, we'll generate a broken Supabase URL.
  const jsonCandidate = resolveJsonEncodedImageString(trimmed);
  if (jsonCandidate) {
    const normalizedFromJson = normalizeProductImagePath(jsonCandidate);
    if (normalizedFromJson) return normalizedFromJson;
  }

  if (EXTERNAL_URL_REGEX.test(trimmed)) {
    return trimmed;
  }

  const cleaned = trimmed
    .replace(/^public\//, '')
    .replace(new RegExp(`^${PRODUCT_BUCKET}/`), '')
    .replace(/^storage\/v1\/object\/public\//, '')
    .replace(/^object\/public\//, '')
    .replace(/^\/+/, '');

  if (!cleaned) return null;
  if (cleaned.startsWith('api/placeholder')) return null;

  return `${PUBLIC_BUCKET_BASE}/${cleaned}`;
};

export const normalizeStorageImagePath = (
  imageUrl?: string | null,
  bucketCandidates: string[] = [PRODUCT_BUCKET]
): string | null => {
  if (!imageUrl) return null;

  const trimmed = imageUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/api/placeholder') || trimmed.startsWith('api/placeholder')) return null;

  const jsonCandidate = resolveJsonEncodedImageString(trimmed);
  if (jsonCandidate) {
    const normalizedFromJson = normalizeStorageImagePath(jsonCandidate, bucketCandidates);
    if (normalizedFromJson) return normalizedFromJson;
  }

  if (EXTERNAL_URL_REGEX.test(trimmed)) {
    return trimmed;
  }

  // Preserve root-relative app assets like /bzobee.png.
  // These are not Supabase storage paths and must stay absolute from the site root.
  if (trimmed.startsWith('/') && !trimmed.startsWith('/storage/')) {
    return trimmed;
  }

  const cleaned = trimmed
    .replace(/^public\//, '')
    .replace(/^storage\/v1\/object\/public\//, '')
    .replace(/^object\/public\//, '')
    .replace(/^\/+/, '');

  if (!cleaned) return null;

  for (const bucket of bucketCandidates) {
    const normalizedBucket = String(bucket || '').trim();
    if (!normalizedBucket) continue;
    const withoutBucketPrefix = cleaned.replace(new RegExp(`^${normalizedBucket}/`), '');
    if (withoutBucketPrefix) {
      return `${supabaseUrl}/storage/v1/object/public/${normalizedBucket}/${withoutBucketPrefix}`;
    }
  }

  return cleaned;
};

const extractImageUrl = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const candidate =
      (value as any).image_url ||
      (value as any).url ||
      (value as any).src ||
      (value as any).path ||
      null;
    return typeof candidate === 'string' ? candidate : null;
  }
  return null;
};

export const normalizeProductImages = (images?: unknown): string[] => {
  if (!images) return [];

  let list: unknown[] = [];

  if (Array.isArray(images)) {
    list = images;
  } else if (typeof images === 'string') {
    const trimmed = images.trim();
    if (!trimmed) return [];
    // If we get URL-encoded JSON, decode + parse it.
    const decodedCandidate = resolveJsonEncodedImageString(trimmed);
    if (decodedCandidate) {
      list = [decodedCandidate];
    } else
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        list = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        list = [trimmed];
      }
    } else {
      list = [trimmed];
    }
  } else {
    list = [images];
  }

  const normalized: string[] = [];
  for (const entry of list) {
    const raw = extractImageUrl(entry);
    const normalizedUrl = normalizeProductImagePath(raw);
    if (normalizedUrl) normalized.push(normalizedUrl);
  }

  return normalized;
};

export const normalizeProductVideos = (videos?: unknown): string[] => {
  if (!videos) return [];

  let list: unknown[] = [];

  if (Array.isArray(videos)) {
    list = videos;
  } else if (typeof videos === 'string') {
    const trimmed = videos.trim();
    if (!trimmed) return [];

    const decoded = /%5B|%7B|%22/i.test(trimmed) ? tryDecodeURIComponent(trimmed) : trimmed;
    const decodedTrimmed = decoded.trim();
    if (decodedTrimmed.startsWith('[') || decodedTrimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(decodedTrimmed);
        list = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        list = [trimmed];
      }
    } else {
      list = [trimmed];
    }
  } else {
    list = [videos];
  }

  const normalized: string[] = [];
  for (const entry of list) {
    const raw = extractImageUrl(entry);
    const normalizedUrl = normalizeStorageImagePath(raw, [PRODUCT_BUCKET]);
    const cleaned = String(normalizedUrl || '').trim();
    if (!cleaned) continue;
    if (/^\[object Object\]$/i.test(cleaned)) continue;
    if (normalized.includes(cleaned)) continue;
    normalized.push(cleaned);
  }

  return normalized;
};

export const getFallbackProductImage = (seed?: string): string =>
  FALLBACK_PRODUCT_IMAGES[seedToIndex(seed)];

export const resolveProductImage = (
  imageUrl?: string | null,
  seed?: string,
): string => normalizeProductImagePath(imageUrl) ?? getFallbackProductImage(seed);

export const resolveProductImageFromList = (images?: unknown, seed?: string): string => {
  const normalized = normalizeProductImages(images);
  return normalized[0] || getFallbackProductImage(seed);
};
