import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Grid, List, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { extractUsStateFromLocation, matchesStatesServed } from '../utils/locationMatching';
import { getReferralData } from '../utils/referralTracking';

type Listing = {
  id: string;
  slug: string;
  agency_name: string;
  bio: string;
  hero_subtitle?: string;
  verticals: string[];
  states_served: string[];
  lead_price: number;
  affiliate_payout: number;
  campaign_status: string;
  pricing_mode: string;
  lead_delivery_enabled?: boolean;
  promotable_by_affiliates?: boolean;
  activation_label?: string;
  agency_profile?: {
    response_time?: string;
    trust_points?: string[];
  };
};

const slugify = (value: string) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));

const InsuranceMarketplacePage: React.FC = () => {
  const { profile } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAllStates, setShowAllStates] = useState(false);

  const viewerState = useMemo(
    () => extractUsStateFromLocation((profile as any)?.location || ''),
    [profile]
  );
  const affiliateRef = useMemo(() => getReferralData().affiliateId || '', []);
  const buildListingHref = (slug: string) =>
    affiliateRef ? `/insurance/${slug}?ref=${encodeURIComponent(affiliateRef)}` : `/insurance/${slug}`;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/public/insurance/marketplace');
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(payload?.error || 'Unable to load insurance marketplace'));
        if (!alive) return;
        setListings(Array.isArray(payload?.listings) ? payload.listings : []);
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message || 'Unable to load insurance marketplace');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    listings.forEach((listing) => {
      for (const vertical of listing.verticals || []) {
        const label = String(vertical || '').trim();
        if (!label) continue;
        counts.set(label, (counts.get(label) || 0) + 1);
      }
    });
    return Array.from(counts.entries()).map(([label, count]) => ({
      label,
      slug: slugify(label),
      count,
    }));
  }, [listings]);

  const filteredListings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const baseResults = listings.filter((listing) => {
      const matchesSearch =
        !term ||
        listing.agency_name.toLowerCase().includes(term) ||
        listing.bio.toLowerCase().includes(term) ||
        listing.verticals.some((vertical) => vertical.toLowerCase().includes(term));
      const matchesCategory =
        selectedCategory === 'all' ||
        listing.verticals.some((vertical) => slugify(vertical) === selectedCategory);
      return matchesSearch && matchesCategory;
    });

    const localized = baseResults.map((listing) => ({
      ...listing,
      isLocalMatch: matchesStatesServed(viewerState, listing.states_served),
    }));

    localized.sort((a, b) => {
      if (Number(b.isLocalMatch) !== Number(a.isLocalMatch)) {
        return Number(b.isLocalMatch) - Number(a.isLocalMatch);
      }
      return a.agency_name.localeCompare(b.agency_name);
    });

    if (viewerState && !showAllStates) {
      const localMatches = localized.filter((listing) => listing.isLocalMatch);
      if (localMatches.length > 0) return localMatches;
    }

    return localized;
  }, [listings, searchTerm, selectedCategory, showAllStates, viewerState]);

  const shelves = useMemo(() => {
    const rows = new Map<string, Listing[]>();
    filteredListings.forEach((listing) => {
      const vertical = String((listing.verticals || [])[0] || 'life');
      if (!rows.has(vertical)) rows.set(vertical, []);
      rows.get(vertical)!.push(listing);
    });
    return Array.from(rows.entries()).map(([vertical, items]) => ({
      vertical,
      slug: slugify(vertical),
      items,
    }));
  }, [filteredListings]);

  return (
    <div className="min-h-screen bg-[#eaeded]">
      <section className="sticky top-16 z-20 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search insurance stores"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffcb05]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/insurance/agent/setup"
                className="rounded-2xl border border-[#131921] bg-[#131921] px-4 py-3 text-sm font-semibold text-white"
              >
                Agent control
              </Link>
              <div className="flex rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`rounded-2xl p-2 transition ${viewMode === 'grid' ? 'bg-white shadow' : 'text-slate-500'}`}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`rounded-2xl p-2 transition ${viewMode === 'list' ? 'bg-white shadow' : 'text-slate-500'}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                selectedCategory === 'all'
                  ? 'border-[#131921] bg-[#131921] text-white'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              All Verticals
            </button>
            {categories.map((option) => (
              <button
                key={option.slug}
                type="button"
                onClick={() => setSelectedCategory(option.slug)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  selectedCategory === option.slug
                    ? 'border-[#131921] bg-[#131921] text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {option.label} ({option.count})
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Insurance is handled differently from products</h2>
          <p className="mt-2 text-sm text-slate-600">
            Product stores use checkout, carts, and fulfillment. Insurance agent pages use a verified lead flow: custom questionnaire, Twilio phone verification, qualified delivery, wallet charging, and dispute protection.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/insurance/agent/setup"
              className="rounded-full bg-[#131921] px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Create insurance agent page
            </Link>
            <Link
              to="/add-product"
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Go to product store setup
            </Link>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing <strong>{filteredListings.length}</strong> insurance storefronts
          </span>
          <span className="font-semibold text-[#0f6cbf]">Free websites can be live before lead credits are funded. Affiliates should promote the ones marked credits active.</span>
        </div>

        {viewerState && (
          <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-slate-900">Local match mode: {viewerState}</div>
              <div>Insurance stores serving your state are shown first to reduce wasted traffic and bad lead matches.</div>
            </div>
            <button
              type="button"
              onClick={() => setShowAllStates((current) => !current)}
              className="rounded-full border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition hover:border-[#ffcb05] hover:bg-amber-50"
            >
              {showAllStates ? 'Show local first' : 'Show all states'}
            </button>
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            ))}
          </div>
        )}

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {!loading && filteredListings.length === 0 && !error && (
          <div className="rounded-3xl border border-dashed border-amber-300 bg-white p-12 text-center">
            <h3 className="mb-3 text-xl font-semibold text-slate-900">No insurance storefronts found.</h3>
            <p className="mb-6 text-slate-600">Set up the free website first, then fund credits when you want Beezio to route leads.</p>
            <Link
              to="/insurance/agent/setup"
              className="rounded-full bg-[#ffcb05] px-6 py-3 font-semibold text-[#131921] transition hover:bg-[#f0b400]"
            >
              Open agent control
            </Link>
          </div>
        )}

        {!loading && filteredListings.length > 0 && selectedCategory === 'all' && !searchTerm.trim() && (
          <div className="space-y-8">
            {shelves.map((row) => (
              <section key={row.slug} className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{row.vertical}</h2>
                    <p className="text-sm text-slate-500">{row.items.length} insurance stores</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(row.slug)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#ffcb05] hover:bg-amber-50"
                  >
                    View more
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="-mx-1 overflow-x-auto pb-2">
                  <div className="flex min-w-max gap-3 px-1">
                    {row.items.map((listing) => (
                      <Link
                        key={listing.id}
                        to={buildListingHref(listing.slug)}
                        className="w-[260px] rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{listing.verticals.join(', ')}</p>
                            <h3 className="mt-2 text-lg font-bold text-slate-900">{listing.agency_name}</h3>
                            <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${listing.lead_delivery_enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                              {listing.activation_label || (listing.lead_delivery_enabled ? 'Credits active' : 'Free website only')}
                            </div>
                          </div>
                          {listing.lead_delivery_enabled ? (
                            <div className="rounded-2xl bg-[#fff3c4] px-3 py-2 text-right text-[#6b5200]">
                              <div className="text-[11px] font-semibold uppercase tracking-wide">Affiliate earns</div>
                              <div className="text-lg font-black">{formatMoney(listing.affiliate_payout)}</div>
                            </div>
                          ) : (
                            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right text-slate-600">
                              <div className="text-[11px] font-semibold uppercase tracking-wide">Promotion status</div>
                              <div className="text-sm font-black">Awaiting credits</div>
                            </div>
                          )}
                        </div>
                        <p className="mt-4 line-clamp-3 text-sm text-slate-600">{listing.hero_subtitle || listing.bio}</p>
                        {Array.isArray(listing.agency_profile?.trust_points) &&
                          listing.agency_profile.trust_points.filter(Boolean).slice(0, 2).length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {listing.agency_profile.trust_points
                                .filter((point) => String(point || '').trim())
                                .slice(0, 2)
                                .map((point) => (
                                  <span key={point} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                    {point}
                                  </span>
                                ))}
                            </div>
                          )}
                        {listing.agency_profile?.response_time && (
                          <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#0f6cbf]">
                            Typical response: {listing.agency_profile.response_time}
                          </div>
                        )}
                        <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Insurance store</div>
                        <div className={`mt-4 rounded-2xl px-4 py-3 ${listing.lead_delivery_enabled ? 'bg-[#131921] text-white' : 'bg-slate-100 text-slate-800'}`}>
                          <div className={`text-[11px] uppercase tracking-wide ${listing.lead_delivery_enabled ? 'text-white/65' : 'text-slate-500'}`}>
                            {listing.lead_delivery_enabled ? 'Qualified lead value' : 'Website status'}
                          </div>
                          <div className="text-2xl font-black">{listing.lead_delivery_enabled ? formatMoney(listing.lead_price) : 'Free site live'}</div>
                        </div>
                        <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#131921]">
                          Open store page
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        {!loading && filteredListings.length > 0 && (selectedCategory !== 'all' || searchTerm.trim()) && (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4' : 'space-y-4'}>
            {filteredListings.map((listing) => (
              <Link
                key={listing.id}
                to={buildListingHref(listing.slug)}
                className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  viewMode === 'list' ? 'flex items-start justify-between gap-5' : ''
                }`}
              >
                <div className={viewMode === 'list' ? 'flex-1' : ''}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{listing.verticals.join(', ')}</p>
                  <h3 className="mt-2 text-lg font-bold text-slate-900">{listing.agency_name}</h3>
                  <p className="mt-3 text-sm text-slate-600">{listing.bio}</p>
                  <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${listing.lead_delivery_enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                    {listing.activation_label || (listing.lead_delivery_enabled ? 'Credits active' : 'Free website only')}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(listing.states_served || []).slice(0, 4).map((state) => (
                      <span key={state} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {state}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-4 space-y-2 rounded-2xl bg-[#fff8dc] px-4 py-3 text-sm text-slate-800">
                  <div>Affiliate earns: <strong>{listing.lead_delivery_enabled ? formatMoney(listing.affiliate_payout) : 'Credits required'}</strong></div>
                  <div>Agent pays: <strong>{listing.lead_delivery_enabled ? formatMoney(listing.lead_price) : 'Free website only'}</strong></div>
                  <div>Status: <strong>{listing.campaign_status}</strong></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default InsuranceMarketplacePage;
