import { isAllowedAdminEmail } from '../../shared/adminAccess';

export const ADMIN_ONLY_LOW_PRICE_THRESHOLD = 1;

type AdminIdentityInput = {
  profile?: any;
  user?: { email?: string | null } | null;
  userRoles?: string[] | null;
};

type LowPricePolicyInput = {
  isAdmin: boolean;
  listingPrice?: number | null;
  sellerAmount?: number | null;
  shippingAmount?: number | null;
  flatCommissionAmount?: number | null;
};

const toMoney = (value: unknown): number | null => {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed);
};

export const isAdminUser = ({ profile, user, userRoles }: AdminIdentityInput): boolean => {
  const role = String(profile?.primary_role || profile?.role || '').trim().toLowerCase();
  if (role === 'admin') return true;

  const normalizedRoles = Array.isArray(userRoles)
    ? userRoles.map((item) => String(item || '').trim().toLowerCase())
    : [];
  if (normalizedRoles.includes('admin')) return true;

  const email = String(profile?.email || user?.email || '').trim().toLowerCase();
  return isAllowedAdminEmail(email);
};

export const getAdminOnlyLowPriceMessage = (input: LowPricePolicyInput): string | null => {
  if (input.isAdmin) return null;

  const violations: string[] = [];
  const fields: Array<{ label: string; value: number | null | undefined }> = [
    { label: 'listing price', value: toMoney(input.listingPrice) },
    { label: 'seller amount', value: toMoney(input.sellerAmount) },
    { label: 'shipping amount', value: toMoney(input.shippingAmount) },
    { label: 'flat commission', value: toMoney(input.flatCommissionAmount) },
  ];

  for (const field of fields) {
    if (field.value !== null && field.value > 0 && field.value < ADMIN_ONLY_LOW_PRICE_THRESHOLD) {
      violations.push(`${field.label} $${field.value.toFixed(2)}`);
    }
  }

  if (violations.length === 0) return null;

  return `Only admins can save test-priced products below $${ADMIN_ONLY_LOW_PRICE_THRESHOLD.toFixed(2)}. Adjust these values or use an admin account: ${violations.join(', ')}.`;
};
