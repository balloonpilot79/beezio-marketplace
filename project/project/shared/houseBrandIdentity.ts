export type HouseBrandSlug = 'marebelle' | 'redtail' | 'loving-nutrition';

export type HouseBrandIdentity = {
  slug: HouseBrandSlug;
  name: string;
  personality: string;
  headerLabel: string;
  kicker: string;
  about: string;
  heroUrl: string;
  logoUrl: string;
  accentColor: string;
};

export const HOUSE_BRAND_IDENTITIES: Record<HouseBrandSlug, HouseBrandIdentity> = {
  marebelle: {
    slug: 'marebelle',
    name: 'MareBelle',
    personality: 'equestrian-luxury',
    headerLabel: 'Equestrian boutique',
    kicker: 'Horse-inspired shirts • western style • equestrian home accents',
    about: 'MareBelle is an equestrian-inspired lifestyle store featuring horse-themed shirts, western apparel, and equestrian home accents.',
    heroUrl: '/marebelle-editorial-hero.png',
    logoUrl: '/marebelle-editorial-logo.png',
    accentColor: '#c9a462',
  },
  redtail: {
    slug: 'redtail',
    name: 'RedTail',
    personality: 'coffee-roastery',
    headerLabel: 'RedTail Coffee merchandise',
    kicker: 'Graphic apparel • mugs • gifts',
    about: 'Explore the RedTail Coffee merchandise collection, including graphic apparel, mugs, and gifts for first responders and outdoor enthusiasts.',
    heroUrl: '/redtail-coffee-hero.png',
    logoUrl: '/redtail-editorial-logo.png',
    accentColor: '#b52025',
  },
  'loving-nutrition': {
    slug: 'loving-nutrition',
    name: 'Loving Nutrition',
    personality: 'nutrition-wellness',
    headerLabel: 'Nutrition & wellness',
    kicker: 'Everyday nutrition • wellness • healthy living',
    about: 'Loving Nutrition is an independent wellness brand focused on thoughtful nutrition and healthier everyday routines.',
    heroUrl: '/loving-nutrition-logo.png?v=20260723',
    logoUrl: '/loving-nutrition-logo.png?v=20260723',
    accentColor: '#c7a34a',
  },
};

const PERSONALITY_TO_SLUG = new Map<string, HouseBrandSlug>(
  Object.values(HOUSE_BRAND_IDENTITIES).map((identity) => [identity.personality, identity.slug])
);

export function resolveHouseBrandIdentity(rawSlug: unknown, rawPersonality?: unknown): HouseBrandIdentity | null {
  const slug = String(rawSlug || '').trim().toLowerCase() as HouseBrandSlug;
  if (Object.prototype.hasOwnProperty.call(HOUSE_BRAND_IDENTITIES, slug)) {
    return HOUSE_BRAND_IDENTITIES[slug];
  }

  const personality = String(rawPersonality || '').trim().toLowerCase();
  const personalitySlug = PERSONALITY_TO_SLUG.get(personality);
  return personalitySlug ? HOUSE_BRAND_IDENTITIES[personalitySlug] : null;
}
