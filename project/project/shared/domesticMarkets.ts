export const DOMESTIC_MARKETS = {
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
} as const;

export type DomesticMarket = keyof typeof DOMESTIC_MARKETS;

export function parseDomesticMarket(value: unknown): DomesticMarket | null {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(DOMESTIC_MARKETS, value)
    ? value as DomesticMarket
    : null;
}

export function isDomesticMarketDraft(market: DomesticMarket | null): boolean {
  return market !== null && market !== 'US';
}
