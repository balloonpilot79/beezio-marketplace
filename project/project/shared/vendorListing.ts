export const ITEM_CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'For Parts / Repair'] as const;

export const MERCHANDISE_TYPES = [
  'Vintage', 'Antique', 'Collectible', 'Handmade', 'Refurbished',
  'Open Box', 'One of a Kind', 'Flea Market', 'Estate Sale',
] as const;

export function matchesMerchandiseFilter(
  product: { item_condition?: string | null; merchandise_types?: string[] | null },
  filter: string,
): boolean {
  if (!filter) return true;
  if (filter === 'New') return product.item_condition === 'New';
  if (filter === 'Used') return Boolean(product.item_condition && product.item_condition !== 'New');
  return product.merchandise_types?.includes(filter) ?? false;
}
