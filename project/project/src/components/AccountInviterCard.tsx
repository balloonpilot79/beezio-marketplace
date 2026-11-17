import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { loadAccountInviters, type AccountInviter } from '../utils/accountInviters';

export function AccountInviterDetails({ inviters }: { inviters: AccountInviter[] }) {
  if (!inviters.length) return null;
  return <section aria-label="Who invited you" className="my-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
    {inviters.map(inviter => <div key={inviter.id} className="py-1">
      <p className="text-sm font-semibold">{`Invited by ${inviter.name}`}</p>
      {inviter.code && <p className="mt-1 break-words text-xs">{`Referral code: ${inviter.code}`}</p>}
      {inviter.roles.length > 0 && <p className="mt-1 text-xs">Referral attached for: {inviter.roles.map(role => role === 'buyer' ? 'Shopping' : role === 'seller' ? 'Selling' : 'Affiliate promotion').join(' · ')}</p>}
    </div>)}
  </section>;
}

export default function AccountInviterCard() {
  const { user, profile } = useAuth();
  const profileId = user && !profile?.__is_fallback ? String(profile?.id || '') : '';
  const [state, setState] = useState<{ profileId: string; inviters: AccountInviter[]; error?: boolean }>({ profileId: '', inviters: [] });
  useEffect(() => {
    if (!profileId) return;
    let active = true;
    void loadAccountInviters(supabase, profileId)
      .then(inviters => { if (active) setState({ profileId, inviters }); })
      .catch(() => { if (active) setState({ profileId, inviters: [], error: true }); });
    return () => { active = false; };
  }, [profileId]);
  if (!profileId || state.profileId !== profileId) return null;
  if (state.error) return <p role="status" className="my-4 text-sm text-slate-600">Your inviter details could not be loaded. Refresh to try again.</p>;
  return <AccountInviterDetails inviters={state.inviters} />;
}
