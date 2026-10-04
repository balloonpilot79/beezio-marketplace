import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContextMultiRole';
import StorefrontShoppingLinks from './StorefrontShoppingLinks';

export default function CompactStoreHeader({ name, logoUrl, homePath, inverse = false, onContact }: {
  name: string; logoUrl?: string | null; homePath: string; inverse?: boolean; onContact?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const next = encodeURIComponent(location.pathname + location.search);
  return (
    <header className={`sticky top-0 z-40 border-b lg:hidden ${inverse ? 'border-white/20 bg-[#070707] text-white' : 'border-slate-200 bg-white text-slate-900'}`}>
      <div className="flex h-16 items-center gap-2 px-3">
        <Link to={homePath} className="flex min-w-0 flex-1 items-center gap-2">
          {logoUrl ? <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400 font-bold text-slate-900">{name.charAt(0)}</span>}
          <span className="truncate text-base font-bold">{name}</span>
        </Link>
        <StorefrontShoppingLinks inverse={inverse} compact />
        <button type="button" onClick={() => setOpen(!open)} aria-label={open ? 'Close store menu' : 'Open store menu'} aria-expanded={open} aria-controls="compact-store-menu" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && <nav id="compact-store-menu" aria-label="Store menu" className="flex flex-wrap items-center gap-2 border-t border-current/10 px-3 py-2 text-sm font-semibold">
        <a href="#products" onClick={() => setOpen(false)} className="px-3 py-3">Products</a>
        {!user && <Link to={`/account/signup?next=${next}`} className="px-3 py-3">Sign up</Link>}
        {onContact && <button type="button" onClick={() => { setOpen(false); onContact(); }} className="px-3 py-3">Contact</button>}
      </nav>}
    </header>
  );
}
