import { normalizeUsState } from './locationMatching';

export type SignupAddress = {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
};

export function parseSignupAddress(input: Partial<SignupAddress> | undefined): SignupAddress {
  const streetAddress = input?.streetAddress?.trim() || '';
  const city = input?.city?.trim() || '';
  const state = normalizeUsState(input?.state);
  const zipCode = input?.zipCode?.trim() || '';

  if (!streetAddress || !city) throw new Error('Enter your street address and city.');
  if (!/^[A-Z]{2}$/.test(state)) throw new Error('Enter a valid U.S. state.');
  if (!/^\d{5}(-\d{4})?$/.test(zipCode)) throw new Error('Enter a valid ZIP code.');

  return { streetAddress, city, state, zipCode };
}
