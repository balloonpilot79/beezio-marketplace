import React, { useState } from 'react';
import { Share2, Copy, Facebook } from 'lucide-react';

interface Props {
  productUrl: string;
  title: string;
  price: number;
  commission?: number;
  canPromote?: boolean;
}

/** Shares the canonical product URL including any existing affiliate attribution. */
export default function ProductShareActions({ productUrl, title, price, commission = 0, canPromote = false }: Props) {
  const [mode, setMode] = useState<'sale' | 'earn' | 'invite'>('sale');
  const [copied, setCopied] = useState(false);
  const url = new URL(productUrl, window.location.origin).toString();
  const inviteUrl = new URL('/signup', window.location.origin).toString();
  const destination = mode === 'invite' ? inviteUrl : url;
  const message = mode === 'sale'
    ? `${title} — $${price.toFixed(2)}. Shop here: ${url}`
    : mode === 'earn'
      ? `Love ${title}? Share products you love and earn on qualifying sales with a free Beezio store. See this product: ${url}`
      : `Want to earn online? Open a free Beezio store, share products, or refer other participants. Get started: ${inviteUrl}`;
  const shareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(destination)}`, '_blank', 'noopener,noreferrer');
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      window.prompt('Copy your share message:', message);
    }
  };
  return (
    <div className="mt-3 rounded-xl border border-gray-200 p-3 text-sm" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-2 font-semibold text-gray-800"><Share2 size={16} /> Share this product</div>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Choose sharing purpose">
        <button type="button" onClick={() => setMode('sale')} aria-pressed={mode === 'sale'} className={`rounded-lg px-2 py-2 ${mode === 'sale' ? 'bg-indigo-100 text-indigo-900' : 'bg-gray-100'}`}>Sell product</button>
        <button type="button" onClick={() => setMode('earn')} aria-pressed={mode === 'earn'} className={`rounded-lg px-2 py-2 ${mode === 'earn' ? 'bg-indigo-100 text-indigo-900' : 'bg-gray-100'}`}>Earn by sharing</button>
        <button type="button" onClick={() => setMode('invite')} aria-pressed={mode === 'invite'} className={`rounded-lg px-2 py-2 ${mode === 'invite' ? 'bg-indigo-100 text-indigo-900' : 'bg-gray-100'}`}>Invite to earn</button>
      </div>
      {mode === 'earn' && <p className="mt-2 text-gray-600">{canPromote && commission > 0 ? `Listed affiliate earning: $${commission.toFixed(2)} per qualifying sale.` : 'Sign up or log in to get your own tracked affiliate link. Sharing without one does not earn a commission.'}</p>}
      {mode === 'invite' && <p className="mt-2 text-gray-600">Create a free store, promote products, or invite others. Referral credit requires your personal influencer link.</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={shareFacebook} className="flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-white"><Facebook size={16}/> Facebook</button>
        <button type="button" onClick={copy} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-gray-800"><Copy size={16}/>{copied ? 'Copied' : 'Copy post'}</button>
      </div>
    </div>
  );
}
