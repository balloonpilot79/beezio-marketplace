const normalizeKey = (value: unknown) =>
  String(value || '').trim().toUpperCase().replace(/\s+/g, '');

const validRate = (value: unknown): number | null => {
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : null;
};

export function resolveLocationTaxRate(params: {
  country?: unknown;
  state?: unknown;
  postalCode?: unknown;
  configuredRatesJson?: unknown;
  fallbackRate?: unknown;
  disabled?: boolean;
}): { rate: number; source: string } {
  if (params.disabled) return { rate: 0, source: 'disabled' };

  const country = normalizeKey(params.country || 'US');
  const state = normalizeKey(params.state);
  const postal = normalizeKey(params.postalCode).replace(/[^A-Z0-9-]/g, '');
  let configured: Record<string, unknown> = {};

  try {
    const parsed = typeof params.configuredRatesJson === 'string'
      ? JSON.parse(params.configuredRatesJson)
      : params.configuredRatesJson;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      configured = parsed as Record<string, unknown>;
    }
  } catch {
    configured = {};
  }

  const normalizedRates = new Map(
    Object.entries(configured).map(([key, value]) => [normalizeKey(key), value])
  );
  const candidates = [
    postal && state ? `${country}-${state}-${postal}` : '',
    state ? `${country}-${state}` : '',
    country,
  ].filter(Boolean);

  for (const key of candidates) {
    const rate = validRate(normalizedRates.get(key));
    if (rate !== null) return { rate, source: `location:${key}` };
  }

  return {
    rate: validRate(params.fallbackRate) ?? 0,
    source: 'configured_fallback',
  };
}
