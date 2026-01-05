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
  if (EXTERNAL_URL_REGEX.test(trimmed)) {
    return trimmed;
  }

  let cleaned = trimmed
    .replace(/^public\//, '')
    .replace(new RegExp(`^${PRODUCT_BUCKET}/`), '')
    .replace(/^storage\/v1\/object\/public\//, '')
    .replace(/^object\/public\//, '')
    .replace(/^\/+/, '');

  if (!cleaned) return null;

  return `${PUBLIC_BUCKET_BASE}/${cleaned}`;
};

export const getFallbackProductImage = (seed?: string): string =>
  FALLBACK_PRODUCT_IMAGES[seedToIndex(seed)];

export const resolveProductImage = (
  imageUrl?: string | null,
  seed?: string,
): string => normalizeProductImagePath(imageUrl) ?? getFallbackProductImage(seed);
