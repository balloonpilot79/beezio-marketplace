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

export const normalizeUsState = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (US_STATE_CODES.has(upper)) return upper;
  const lower = raw.toLowerCase();
  return US_STATE_NAME_TO_CODE[lower] || '';
};

export const extractUsStateFromLocation = (value: unknown): string => {
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

export const normalizeUsStateList = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((value) => normalizeUsState(value))
        .filter(Boolean)
    )
  );
};

export const matchesStatesServed = (viewerState: unknown, statesServed: unknown): boolean => {
  const targetState = normalizeUsState(viewerState);
  const normalizedStates = normalizeUsStateList(statesServed);
  if (!targetState || normalizedStates.length === 0) return false;
  return normalizedStates.includes(targetState);
};
