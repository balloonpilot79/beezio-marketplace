import { useEffect, useState } from 'react';

export type RecruitInvite = {
  code: string;
  status: 'checking' | 'accepted' | 'invalid' | 'error';
  referrerName?: string;
  referrerProfileId?: string;
};

export function useRecruitInvite(code: string | null | undefined): RecruitInvite | null {
  const cleanCode = String(code || '').trim();
  const [result, setResult] = useState<RecruitInvite | null>(null);
  useEffect(() => {
    if (!cleanCode) { setResult(null); return; }
    const controller = new AbortController();
    setResult({ code: cleanCode, status: 'checking' });
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    let active = true;
    void fetch(`/api/public/recruit/resolve?code=${encodeURIComponent(cleanCode)}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Could not verify invite');
        return response.json();
      })
      .then(payload => {
        if (!active) return;
        setResult({ code: cleanCode, status: payload.ok && payload.valid && payload.referrerProfileId ? 'accepted' : 'invalid',
          referrerName: payload.referrerName, referrerProfileId: payload.referrerProfileId });
      })
      .catch(() => { if (active) setResult({ code: cleanCode, status: 'error' }); })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [cleanCode]);
  if (!cleanCode) return null;
  return result?.code === cleanCode ? result : { code: cleanCode, status: 'checking' };
}

export default function RecruitInviteNotice({ invite }: { invite: RecruitInvite | null }) {
  if (!invite) return null;
  return <div role="status" className="mx-auto my-4 max-w-xl rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
    <p className="font-semibold">Invite link detected</p>
    <p className="mt-1 break-words">Invite code: {invite.code}</p>
    {invite.status === 'checking' && <p className="mt-1">Verifying referrer…</p>}
    {invite.status === 'accepted' && <p className="mt-1">Invite link accepted. Invited by {invite.referrerName || 'a Beezio Ambassador'}.</p>}
    {invite.status === 'invalid' && <p className="mt-1 text-red-800">Invite link could not be verified. Check the link with the person who invited you.</p>}
    {invite.status === 'error' && <p className="mt-1 text-red-800">Your invite could not be checked right now. Refresh to try again.</p>}
  </div>;
}
