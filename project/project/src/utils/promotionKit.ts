import { getBuyerFacingProductPrice, getProductShipping } from './buyerPrice';

export type PromotionProduct = {
  id: string; title: string; price: number; images?: string[]; seller_id?: string;
  calculated_customer_price?: number; shipping_reserve_amount?: number;
  shipping_price?: number; shipping_cost?: number; is_digital?: boolean;
  shipping_options?: unknown; currency?: string; has_variants?: boolean;
};
export const PROMOTION_FIELDS = 'id,title,price,calculated_customer_price,images,seller_id,shipping_reserve_amount,shipping_price,shipping_cost,shipping_options,is_digital,currency,has_variants,is_active,status,is_promotable,affiliate_enabled,in_stock,track_inventory,stock_quantity,total_inventory';
export const DISCLOSURE = 'I may earn a commission if you buy through my link.';
export const escapeMarkup = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function promotionPrice(p: PromotionProduct) {
  return getBuyerFacingProductPrice(p) + getProductShipping(p);
}
export function promotionPriceLabel(p: PromotionProduct) {
  return `${p.has_variants ? 'From ' : ''}${new Intl.NumberFormat('en-US', { style: 'currency', currency: p.currency || 'USD' }).format(promotionPrice(p))}`;
}
export function shippingLabel(p: PromotionProduct) {
  return p.is_digital ? 'Digital item · tax extra' : 'Listed shipping included · tax extra';
}
export function promotionCaption(p: PromotionProduct, link: string) {
  return `${p.title}\n${promotionPriceLabel(p)} — ${shippingLabel(p)}.\nSee options, delivery area and current pricing: ${link}\n\n${DISCLOSURE}`;
}
export function cardEmbed(p: PromotionProduct, link: string) {
  const e = escapeMarkup;
  const image = p.images?.[0];
  return `<div style="max-width:360px;border:1px solid #ddd;border-radius:16px;padding:20px;font-family:Arial,sans-serif;background:white;color:#101820">
${image && /^https?:\/\//.test(image) ? `<img src="${e(image)}" alt="${e(p.title)}" style="width:100%;height:260px;object-fit:contain" loading="lazy">` : ''}
<h3>${e(p.title)}</h3><p>${e(promotionPriceLabel(p))}</p><p>${e(shippingLabel(p))}</p>
<a href="${e(link)}" target="_blank" rel="sponsored noopener" style="display:inline-block;padding:12px 20px;background:#ffcb05;color:#101820;border-radius:8px;font-weight:bold">View product</a>
<p style="font-size:12px">${DISCLOSURE} Price and availability may change; see product page for delivery coverage.</p></div>`;
}
export function collectionLink(productLink: string, ids: string[], title: string) {
  const url = new URL(productLink);
  url.pathname = '/picks';
  url.searchParams.set('items', Array.from(new Set(ids)).slice(0,12).join(','));
  url.searchParams.set('title', title.trim().slice(0,80) || 'My product picks');
  return url.toString();
}
export function parseCollectionIds(value: string) {
  return Array.from(new Set(value.split(',').filter(id => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)))).slice(0,12);
}
