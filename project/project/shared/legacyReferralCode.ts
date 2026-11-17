// Older dashboards emitted ten hexadecimal digits instead of a full UUID.
// Resolve these only when the entire UUID range contains one profile.
export function legacyReferralCodeBounds(code: string) {
  const match = /^bzo-([0-9a-f]{10})$/i.exec(code);
  if (!match) return null;
  const uuid = (hex: string) => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const prefix = match[1].toLowerCase();
  return { lower: uuid(prefix.padEnd(32, '0')), upper: uuid(prefix.padEnd(32, 'f')) };
}
