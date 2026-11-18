import { useEffect, useState } from 'react';

export type RecruitInvite = {
  code: string;
  status: 'checking' | 'accepted' | 'invalid' | 'error';
  referrerName?: string;
  referrerProfileId?: string;
};

async function fetchRecruitInvite(code: string, signal?: AbortSignal): Promise<RecruitInvite> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = window.setTimeout(abort, 12000);

  try {
    const response = await fetch(`/api/public/recruit/resolve?code=${encodeURIComponent(code)}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Could not verify invite');
    const payload = await response.json();
    if (payload.ok !== true) throw new Error('Could not verify invite');
    if (payload.valid === false) return { code, status: 'invalid' };
    if (payload.valid !== true || !payload.referrerProfileId) throw new Error('Incomplete invite response');
    return { code, status: 'accepted', referrerName: payload.referrerName, referrerProfileId: payload.referrerProfileId };
  } catch {
    return { code, status: 'error' };
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function requireRecruitInviter(invite: RecruitInvite | null): Promise<string> {
  if (!invite) return '';
  const result = invite.status === 'accepted' || invite.status === 'invalid'
    ? invite
    : await fetchRecruitInvite(invite.code);
  if (result.status === 'invalid') {
    throw new Error('This invite could not be verified. Ask your Ambassador for a working link, or start a signup without the invite.');
  }
  if (result.status !== 'accepted' || !result.referrerProfileId) {
    throw new Error('We could not verify your invite right now. Try again to continue with referral credit.');
  }
  return result.referrerProfileId;
}

export function useRecruitInvite(code: string | null | undefined): RecruitInvite | null {
  const cleanCode = String(code || '').trim();
  const [result, setResult] = useState<RecruitInvite | null>(null);
  useEffect(() => {
    if (!cleanCode) { setResult(null); return; }
    const controller = new AbortController();
    setResult({ code: cleanCode, status: 'checking' });
    void fetchRecruitInvite(cleanCode, controller.signal).then(result => {
      if (!controller.signal.aborted) setResult(result);
    });
    return () => controller.abort();
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
