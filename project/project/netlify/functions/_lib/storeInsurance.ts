import { buildInsuranceMarketplaceRows } from './insuranceMarketplace';

const US_STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'district of columbia': 'DC',
  dc: 'DC',
};

const US_STATE_CODES = new Set(Object.values(US_STATE_NAME_TO_CODE));

const normalizeUsState = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (US_STATE_CODES.has(upper)) return upper;
  return US_STATE_NAME_TO_CODE[raw.toLowerCase()] || '';
};

const extractUsStateFromLocation = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const segments = raw
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const normalized = normalizeUsState(segments[index]);
    if (normalized) return normalized;
  }

  const words = raw.split(/\s+/).filter(Boolean);
  for (let index = words.length - 1; index >= 0; index -= 1) {
    const normalized = normalizeUsState(words[index]);
    if (normalized) return normalized;
  }

  return '';
};

const normalizeUsStateList = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => normalizeUsState(value)).filter(Boolean)));
};

export async function buildStoreInsuranceListings(supabaseAdmin: any, location: unknown, limit = 6) {
  const viewerState = extractUsStateFromLocation(location);
  let listings: any[] = [];
  try {
    listings = await buildInsuranceMarketplaceRows(supabaseAdmin, false);
  } catch (error: any) {
    // Insurance is an optional storefront enhancement. A replacement or
    // partially migrated database must not make the core storefront fail.
    console.warn(
      '[storeInsurance] Optional insurance listings unavailable:',
      String(error?.message || error?.details || error?.code || error || 'Unknown error')
    );
    return [];
  }

  const scored = listings
    .map((listing) => {
      const statesServed = normalizeUsStateList((listing as any)?.states_served);
      const isLocalMatch = Boolean(viewerState && statesServed.includes(viewerState));
      return {
        ...listing,
        states_served: statesServed,
        is_local_match: isLocalMatch,
      };
    })
    .sort((a: any, b: any) => {
      if (Number(b.is_local_match) !== Number(a.is_local_match)) {
        return Number(b.is_local_match) - Number(a.is_local_match);
      }
      if (Number(a.placement_rank || 100) !== Number(b.placement_rank || 100)) {
        return Number(a.placement_rank || 100) - Number(b.placement_rank || 100);
      }
      return String(a.agency_name || '').localeCompare(String(b.agency_name || ''));
    });

  return scored.slice(0, Math.max(1, limit));
}
