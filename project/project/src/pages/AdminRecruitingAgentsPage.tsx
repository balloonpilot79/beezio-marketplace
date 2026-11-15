import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bot, Check, Clipboard, ExternalLink, Loader2, RefreshCw, Search, Send, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type RoleTarget = 'seller' | 'affiliate' | 'ambassador' | 'buyer';
type Batch = { id: string; status: string; summary: string | null; created_at: string; approved_at: string | null };
type Prospect = { display_name: string; role_target: RoleTarget; source_url: string; contact_path: string | null; fit_reason: string };
type Draft = {
  id: string;
  batch_id: string;
  channel: string;
  action_type: string;
  message_text: string;
  status: string;
  created_at: string;
  recruiting_prospects: Prospect | null;
};
type Overview = {
  settings: { agent_name: string; public_identity: string; monthly_user_goal: number; agent_enabled: boolean } | null;
  batches: Batch[];
  drafts: Draft[];
  month_signups: number;
};

const roleLabels: Record<RoleTarget, string> = {
  seller: 'Sellers',
  affiliate: 'Affiliates',
  ambassador: 'Ambassadors',
  buyer: 'Buyers',
};

export default function AdminRecruitingAgentsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [roles, setRoles] = useState<RoleTarget[]>(['seller', 'affiliate', 'ambassador', 'buyer']);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const callAgent = useCallback(async (payload: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Your admin session expired. Sign in again.');
    const response = await fetch('/.netlify/functions/admin-recruiting-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || 'Recruiting agent request failed');
    setData(result);
    return result;
  }, []);

  const run = useCallback(async (key: string, payload: Record<string, unknown>, success: string) => {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await callAgent(payload);
      setNotice(success);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setBusy('');
    }
  }, [callAgent]);

  useEffect(() => {
    void run('load', { action: 'overview' }, '');
  }, [run]);

  const pendingDrafts = useMemo(() => data?.drafts.filter((draft) => draft.status === 'pending') || [], [data]);
  const approvedDrafts = useMemo(() => data?.drafts.filter((draft) => draft.status === 'approved') || [], [data]);
  const latestPendingBatch = data?.batches.find((batch) => batch.status === 'pending');
  const goal = data?.settings?.monthly_user_goal || 10000;
  const progress = Math.min(100, Math.round(((data?.month_signups || 0) / goal) * 100));

  const toggleRole = (role: RoleTarget) => {
    setRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  };

  const copyDraft = async (draft: Draft) => {
    await navigator.clipboard.writeText(draft.message_text);
    setNotice(`Copied the ${draft.recruiting_prospects?.display_name || 'prospect'} draft.`);
  };

  if (!data && busy === 'load') {
    return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-amber-500" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-[#101820] text-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <Link to="/admin/platform" className="inline-flex items-center gap-2 text-sm font-semibold text-amber-300 hover:text-amber-200"><ArrowLeft className="h-4 w-4" /> Platform admin</Link>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-3"><Bot className="h-8 w-8 text-[#ffcb05]" /><h1 className="text-3xl font-black">Beezio Recruiting Team</h1></div>
              <p className="mt-2 max-w-3xl text-slate-300">Alex researches public opportunities and writes personalized outreach. You approve every message before anything leaves Beezio.</p>
            </div>
            <div className="rounded-xl border border-amber-400/40 bg-white/10 px-4 py-3 text-sm"><div className="font-bold text-[#ffcb05]">Public identity</div><div>{data?.settings?.public_identity || 'Alex | Beezio automated assistant'}</div></div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">{notice}</div>}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm"><div className="text-sm font-semibold text-slate-500">Monthly signup goal</div><div className="mt-1 text-3xl font-black">{goal.toLocaleString()}</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-amber-400" style={{ width: `${progress}%` }} /></div></div>
          <div className="rounded-2xl bg-white p-5 shadow-sm"><div className="text-sm font-semibold text-slate-500">Signups this month</div><div className="mt-1 text-3xl font-black">{(data?.month_signups || 0).toLocaleString()}</div><div className="mt-2 text-sm text-slate-500">{progress}% of goal</div></div>
          <div className="rounded-2xl bg-white p-5 shadow-sm"><div className="text-sm font-semibold text-slate-500">Waiting for your approval</div><div className="mt-1 text-3xl font-black text-amber-700">{pendingDrafts.length}</div><div className="mt-2 text-sm text-slate-500">Approved and ready: {approvedDrafts.length}</div></div>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-xl font-black">Build today’s recruiting queue</h2><p className="mt-1 text-sm text-slate-600">Searches current public sources and prepares a small, reviewable set—no bulk blasting.</p></div>
            <button disabled={busy !== '' || roles.length === 0} onClick={() => void run('discover', { action: 'discover', roles, limit: 12 }, 'Today’s approval queue is ready.')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#101820] px-5 py-3 font-bold text-[#ffcb05] disabled:opacity-50">{busy === 'discover' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />} Find prospects & draft messages</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">{(Object.keys(roleLabels) as RoleTarget[]).map((role) => <button key={role} onClick={() => toggleRole(role)} className={`rounded-full border px-4 py-2 text-sm font-bold ${roles.includes(role) ? 'border-amber-400 bg-amber-100 text-amber-950' : 'border-slate-300 bg-white text-slate-500'}`}>{roles.includes(role) && <Check className="mr-1 inline h-4 w-4" />}{roleLabels[role]}</button>)}</div>
        </section>

        {latestPendingBatch && pendingDrafts.length > 0 && (
          <section className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black">Daily approval required</h2><p className="mt-1 text-sm text-slate-700">{latestPendingBatch.summary || `${pendingDrafts.length} drafts prepared for review.`}</p></div><button disabled={busy !== ''} onClick={() => void run('approve-batch', { action: 'approve_batch', batch_id: latestPendingBatch.id }, 'Batch approved. Messages are ready for authorized channel delivery.')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50"><Check className="h-5 w-5" /> Approve this batch</button></div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-2xl font-black">Outreach drafts</h2><button disabled={busy !== ''} onClick={() => void run('refresh', { action: 'overview' }, 'Refreshed.')} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold"><RefreshCw className="h-4 w-4" /> Refresh</button></div>
          {(data?.drafts || []).length === 0 && <div className="rounded-2xl bg-white p-8 text-center text-slate-500">No drafts yet. Build today’s queue to start.</div>}
          {(data?.drafts || []).map((draft) => {
            const prospect = draft.recruiting_prospects;
            return <article key={draft.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{prospect?.display_name || 'Public prospect'}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase">{prospect?.role_target}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${draft.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : draft.status === 'rejected' ? 'bg-red-100 text-red-800' : draft.status === 'sent' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{draft.status}</span></div><p className="mt-1 text-sm text-slate-600">{draft.channel} · {draft.action_type} · {prospect?.fit_reason}</p></div>{prospect?.source_url && <a href={prospect.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:underline">View source <ExternalLink className="h-4 w-4" /></a>}</div>
              <div className="mt-4 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6">{draft.message_text}</div>
              {prospect?.contact_path && <p className="mt-3 text-xs text-slate-500"><strong>Contact path:</strong> {prospect.contact_path}</p>}
              <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void copyDraft(draft)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"><Clipboard className="h-4 w-4" /> Copy</button>{draft.status === 'pending' && <><button disabled={busy !== ''} onClick={() => void run(`approve-${draft.id}`, { action: 'approve_draft', draft_id: draft.id }, 'Draft approved.')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white"><Check className="h-4 w-4" /> Approve</button><button disabled={busy !== ''} onClick={() => void run(`reject-${draft.id}`, { action: 'reject_draft', draft_id: draft.id }, 'Draft rejected.')} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white"><X className="h-4 w-4" /> Reject</button></>}{draft.status === 'approved' && <button disabled={busy !== ''} onClick={() => void run(`sent-${draft.id}`, { action: 'mark_sent', draft_id: draft.id }, 'Marked sent and added to the activity log.')} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white"><Send className="h-4 w-4" /> Mark posted/sent</button>}</div>
            </article>;
          })}
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white p-5 text-sm text-slate-700"><h2 className="font-black">Channel delivery status</h2><p className="mt-2">Research, personalized drafting, approvals, copying, and activity tracking are active here. Social accounts still need their official API connections before Alex can publish directly. Craigslist and forums without approved APIs remain manual, so the system will never bypass a site’s rules.</p></section>
      </main>
    </div>
  );
}
