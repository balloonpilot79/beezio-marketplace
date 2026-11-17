import { expect, it } from 'vitest';
import { legacyReferralCodeBounds } from './legacyReferralCode';
it('matches only the full historical prefix and preserves all ten digits', () => {
  expect(legacyReferralCodeBounds('bzo-1deb1c6740')).toEqual({ lower: '1deb1c67-4000-0000-0000-000000000000', upper: '1deb1c67-40ff-ffff-ffff-ffffffffffff' });
  expect(legacyReferralCodeBounds('bzo-1deb1c674')).toBeNull();
  expect(legacyReferralCodeBounds('JASO7554')).toBeNull();
  expect(legacyReferralCodeBounds('bzo-1deb1c6740,role.eq.admin')).toBeNull();
});
