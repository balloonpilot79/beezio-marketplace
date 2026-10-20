// Product-specific terms live with the existing per-item shipping configuration.
export const getProductTerms = (raw: unknown): Record<string, string> => {
  let options = raw;
  if (typeof options === 'string') {
    try { options = JSON.parse(options); } catch { return {}; }
  }
  if (!Array.isArray(options) || !options[0] || typeof options[0] !== 'object') return {};
  const result: Record<string, string> = {};
  for (const field of ['processing_time', 'estimated_days', 'shipping_policy', 'return_policy']) {
    if (typeof options[0][field] === 'string') result[field] = options[0][field].trim();
  }
  return result;
};

export const validateProductTerms = (raw: unknown, requiresShipping: boolean): string | null => {
  const terms = getProductTerms(raw);
  if (requiresShipping && !terms.estimated_days) return 'Enter an estimated shipping time for this item.';
  if (!terms.shipping_policy) return 'Enter shipping terms for this item.';
  if (!terms.return_policy) return 'Enter return terms for this item.';
  return null;
};
