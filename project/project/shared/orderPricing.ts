// Quantity never discounts product prices. Seller-selected combined shipping
// is calculated independently from merchandise and promised commissions.
export function getOrderUnitSavings(_items: readonly unknown[], _fixedAllowance = 0.6): number { return 0; }
export function getCartUnitPrice(item: { price?: number }, _items: readonly unknown[]): number {
  return Math.round(Math.max(0, Number(item.price || 0)) * 100) / 100;
}
export function getOrderSavings(_items: readonly unknown[]): number { return 0; }
