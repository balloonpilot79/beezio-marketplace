/** Match each search word across public product information, ignoring punctuation and extra spaces. */
const normalize = (value: unknown): string => String(value ?? '')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function matchesMarketplaceSearch(product: {
  title?: unknown; description?: unknown; category?: unknown;
  category_name?: unknown; derivedCategory?: unknown;
}, query: string): boolean {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const searchable = normalize([
    product.title, product.description, product.category,
    product.category_name, product.derivedCategory,
  ].filter(Boolean).join(' '));
  return terms.every((term) => searchable.includes(term));
}
