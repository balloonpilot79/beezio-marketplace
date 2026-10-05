import { isTestItemTitle } from './testItemPricing';
import { isDollarCheckoutTest } from './dollarCheckoutTest';

type OrderPriceItem = { productId?: string; title?: string; name?: string; quantity: number; isSample?: boolean; price?: number };
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
// Catalog prices include one fixed processing allowance per unit. A single
// payment needs that allowance only once. Round savings down so payouts remain covered.
export function getOrderUnitSavings(items: OrderPriceItem[], fixedAllowance = 0.6): number {
  if (items.some(item => item.isSample || isDollarCheckoutTest(item.productId) || isTestItemTitle(item.title || item.name || ''))) return 0;
  const quantity = items.reduce((total, item) => total + Math.max(1, Math.floor(Number(item.quantity || 1))), 0);
  if (quantity <= 1) return 0;
  const fixedCents = Math.round(Math.max(0, fixedAllowance) * 100);
  return Math.floor(fixedCents * (quantity - 1) / quantity) / 100;
}
export function getCartUnitPrice(item: OrderPriceItem, items: OrderPriceItem[]): number {
  return round2(Math.max(0, Number(item.price || 0) - getOrderUnitSavings(items)));
}
export function getOrderSavings(items: OrderPriceItem[]): number {
  return round2(getOrderUnitSavings(items) * items.reduce((total, item) => total + Math.max(1, Math.floor(Number(item.quantity || 1))), 0));
}
