import { normalizeStoreSlug } from './normalizeStoreSlug';

export const RESERVED_STORE_SLUGS = new Set([
  'home', 'marketplace', 'stores', 'affiliates', 'affiliate', 'partner', 'affiliate-signup', 'affiliate-dashboard-preview',
  'seller', 'sellers', 'store', 'products', 'product', 'dashboard', 'dashboard-preview', 'buyer-dashboard-preview',
  'admin', 'auth', 'login', 'signup', 'onboarding', 'messages', 'earnings', 'checkout', 'cart',
  'about', 'contact', 'privacy', 'terms', 'faq', 'search', 'how-it-works', 'get-started', 'start-earning',
  'add-product', 'add-product-old', 'profile', 'orders', 'order-confirmation', 'contact-support', 'write-review',
  'reset-password', 'change-password', 'revolutionary', 'api'
]);

export const normalizeStoreSlugInput = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

export const deriveStoreSlug = (name: string) => normalizeStoreSlug(normalizeStoreSlugInput(name));

export const isValidStoreSlug = (slug: string) => {
  if (!slug) return false;
  if (!/^[a-z0-9-]{3,32}$/.test(slug)) return false;
  if (slug.includes('beezio') || slug.includes('bzo')) return false;
  if (RESERVED_STORE_SLUGS.has(slug)) return false;
  return true;
};
