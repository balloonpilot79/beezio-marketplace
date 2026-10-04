import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContextMultiRole';
import StorefrontShoppingLinks from './StorefrontShoppingLinks';

export default function CompactStoreHeader({ name, logoUrl, homePath, inverse = false, accentColor = '#c7a34a', label = 'Independent shop', productHref = '#products', onContact }: {
  name: string; logoUrl?: string | null; homePath: string; inverse?: boolean; accentColor?: string; label?: string; productHref?: string; onContact?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const next = encodeURIComponent(location.pathname + location.search);
  return (
    <header style={{ borderBottomColor: accentColor, borderBottomWidth: 2, background: `linear-gradient(120deg, color-mix(in srgb, ${accentColor} 16%, ${inverse ? '#070707' : '#ffffff'}), ${inverse ? '#070707' : '#ffffff'})` }} className={`sticky top-0 z-40 border-b lg:hidden ${inverse ? 'border-white/20 bg-[#070707] text-white' : 'border-slate-200 bg-white text-slate-900'}`}>
      <div className="flex h-16 items-center gap-2 px-3">
        <Link to={homePath} className="flex min-w-0 flex-1 items-center gap-2">
          {logoUrl ? <img src={logoUrl} alt="" style={{ boxShadow: `0 0 0 1px ${accentColor}` }} className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-0.5" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400 font-bold text-slate-900">{name.charAt(0)}</span>}
          <span className="min-w-0"><span className="block truncate text-[8px] font-bold uppercase tracking-[0.18em]" style={{ color: accentColor }}>{label}</span><span className={`block truncate leading-tight ${inverse ? 'font-serif text-xl font-semibold' : 'text-base font-bold'}`} style={{ color: inverse ? '#ffffff' : '#101820' }}>{name}</span></span>
        </Link>
        <StorefrontShoppingLinks inverse={inverse} compact />
        <button type="button" onClick={() => setOpen(!open)} aria-label={open ? 'Close store menu' : 'Open store menu'} aria-expanded={open} aria-controls="compact-store-menu" style={{ color: inverse ? '#ffffff' : '#101820' }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && <nav id="compact-store-menu" aria-label="Store menu" className="flex flex-wrap items-center gap-2 border-t border-current/10 px-3 py-2 text-sm font-semibold">
        <a href={productHref} style={{ color: inverse ? '#ffffff' : '#101820' }} onClick={() => setOpen(false)} className="px-3 py-3">Products</a>
        {!user && <Link to={`/account/signup?next=${next}`} style={{ color: inverse ? '#ffffff' : '#101820' }} className="px-3 py-3">Sign up</Link>}
        {onContact && <button type="button" onClick={() => { setOpen(false); onContact(); }} className="px-3 py-3">Contact</button>}
      </nav>}
    </header>
  );
}
