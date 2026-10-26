import React, { useState } from 'react';
import { Share2, Copy, Facebook } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';

interface Props {
  productId: string;
  productUrl: string;
  title: string;
  price: number;
  commission?: number;
  canPromote?: boolean;
}

type Mode = 'sale' | 'earn' | 'invite';

export default function ProductShareActions({ productId, productUrl, title, price, commission = 0, canPromote = false }: Props) {
  const { user, profile, hasRole, currentRole } = useAuth();
  const [mode, setMode] = useState<Mode>('sale');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const role = String(profile?.primary_role || profile?.role || currentRole || '').toLowerCase();
  const promoter = Boolean(user) && (['affiliate', 'partner', 'seller'].includes(role) || hasRole('affiliate') || hasRole('partner') || hasRole('seller'));
  const influencer = Boolean(user) && (role === 'influencer' || hasRole('influencer'));
  const productLink = new URL(productUrl, window.location.origin).toString();

  async function destination(channel: 'copy' | 'facebook'): Promise<string> {
    if (mode === 'invite') {
      if (!influencer || !profile?.referral_code) throw new Error('Activate your influencer role and referral code to share a credited invitation.');
      const invite = new URL('/signup', window.location.origin);
      invite.searchParams.set('recruit', String(profile.referral_code));
      return invite.toString();
    }
    if (!promoter || !canPromote) {
      if (mode === 'earn') throw new Error('Log in with an affiliate or seller role to generate your own earning link.');
      return productLink;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('Sign in to generate your tracked product link.');
    const response = await fetch('/api/affiliate/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ target_type: 'product', target_id: productId, target_path: new URL(productLink).pathname, source: channel, title }),
    });
    const data = await response.json();
    if (!response.ok || !data.trackedUrl) throw new Error(data.error || 'Could not generate a tracked link.');
    return String(data.trackedUrl);
  }

  async function share(channel: 'copy' | 'facebook') {
    setBusy(true);
    setError('');
    setCopied(false);
    try {
      const url = await destination(channel);
      const message = mode === 'sale'
        ? `${title} — $${price.toFixed(2)}. Shop here: ${url}`
        : mode === 'earn'
          ? `Love ${title}? Earn by sharing products with your free Beezio store. Product: ${url}`
          : `Want to earn online? Open a free Beezio store, promote products, or refer others: ${url}`;
      if (channel === 'facebook') {
        // Open synchronously before awaiting link generation to avoid popup blockers.
        // Facebook builds its own preview from the destination's Open Graph metadata.
        window.location.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
      } else {
        try {
          await navigator.clipboard.writeText(message);
          setCopied(true);
        } catch {
          window.prompt('Copy your share message:', message);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to share this product.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-200 p-3 text-sm" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-2 font-semibold text-gray-800"><Share2 size={16} /> Share this product</div>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Choose sharing purpose">
        <button type="button" onClick={() => setMode('sale')} aria-pressed={mode === 'sale'} className={`rounded-lg px-2 py-2 ${mode === 'sale' ? 'bg-indigo-100 text-indigo-900' : 'bg-gray-100'}`}>Sell product</button>
        <button type="button" onClick={() => setMode('earn')} aria-pressed={mode === 'earn'} className={`rounded-lg px-2 py-2 ${mode === 'earn' ? 'bg-indigo-100 text-indigo-900' : 'bg-gray-100'}`}>Earn by sharing</button>
        <button type="button" onClick={() => setMode('invite')} aria-pressed={mode === 'invite'} className={`rounded-lg px-2 py-2 ${mode === 'invite' ? 'bg-indigo-100 text-indigo-900' : 'bg-gray-100'}`}>Invite to earn</button>
      </div>
      {mode === 'earn' && <p className="mt-2 text-gray-600">{canPromote && commission > 0 ? `Listed affiliate earning: $${commission.toFixed(2)} per qualifying sale.` : 'An eligible affiliate product and your own tracked link are required to earn.'}</p>}
      {mode === 'invite' && <p className="mt-2 text-gray-600">Influencer referral credit requires an active influencer account and its referral code.</p>}
      {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => share('facebook')} className="flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-white disabled:opacity-50"><Facebook size={16}/> Facebook</button>
        <button type="button" disabled={busy} onClick={() => share('copy')} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-gray-800 disabled:opacity-50"><Copy size={16}/>{copied ? 'Copied' : 'Copy post'}</button>
      </div>
    </div>
  );
}
