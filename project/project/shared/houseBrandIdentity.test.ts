import { describe, expect, it } from 'vitest';
import { HOUSE_BRAND_IDENTITIES, resolveHouseBrandIdentity } from './houseBrandIdentity';

describe('house brand identity boundaries', () => {
  it.each([
    ['marebelle', 'nutrition-wellness', 'MareBelle'],
    ['redtail', 'equestrian-luxury', 'RedTail'],
    ['loving-nutrition', 'equestrian-luxury', 'Loving Nutrition'],
  ])('lets the exact slug override a conflicting shared profile personality', (slug, personality, expectedName) => {
    expect(resolveHouseBrandIdentity(slug, personality)?.name).toBe(expectedName);
  });

  it('keeps every protected brand copy free of the other protected brand names', () => {
    const identities = Object.values(HOUSE_BRAND_IDENTITIES);
    for (const identity of identities) {
      const copy = `${identity.name} ${identity.headerLabel} ${identity.kicker} ${identity.about}`.toLowerCase();
      for (const other of identities.filter((candidate) => candidate.slug !== identity.slug)) {
        expect(copy).not.toContain(other.name.toLowerCase());
      }
    }
  });

  it('keeps equestrian language exclusive to MareBelle', () => {
    expect(HOUSE_BRAND_IDENTITIES.marebelle.about.toLowerCase()).toContain('equestrian');
    expect(HOUSE_BRAND_IDENTITIES.redtail.about.toLowerCase()).not.toContain('equestrian');
    expect(HOUSE_BRAND_IDENTITIES['loving-nutrition'].about.toLowerCase()).not.toContain('equestrian');
  });

  it('keeps RedTail exclusively positioned as a coffee brand', () => {
    const redtail = `${HOUSE_BRAND_IDENTITIES.redtail.headerLabel} ${HOUSE_BRAND_IDENTITIES.redtail.kicker} ${HOUSE_BRAND_IDENTITIES.redtail.about}`.toLowerCase();
    expect(redtail).toContain('coffee');
    expect(redtail).not.toMatch(/automotive|detailing|car care|vehicle/);
  });
});
