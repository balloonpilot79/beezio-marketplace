import { supabase } from '../lib/supabase';

export const getPayoutSettingsHref = (role: string): string => {
  const normalizedRole = String(role || '').trim().toLowerCase();
  if (normalizedRole === 'affiliate' || normalizedRole === 'partner') {
    return '/dashboard?section=affiliate&tab=financials#payouts';
  }
  if (normalizedRole === 'influencer') {
    return '/dashboard?section=influencer#payouts';
  }
  return '/dashboard?section=seller&tab=financials#payouts';
};

export const hasStoredPayoutEmail = async (ownerIds: Array<string | null | undefined>): Promise<boolean> => {
  const candidateOwnerIds = Array.from(
    new Set(
      ownerIds
        .map((value) => String(value || '').trim())
        .filter((value) => value.length > 0)
    )
  );

  if (!candidateOwnerIds.length) return false;

  const { data, error } = await supabase
    .from('paypal_accounts')
    .select('paypal_email')
    .in('user_id', candidateOwnerIds);

  if (error) {
    throw error;
  }

  const rows = (data as any[]) || [];
  return rows.some((row) => String(row?.paypal_email || '').trim().length > 0);
};
