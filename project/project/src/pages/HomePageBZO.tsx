import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeDollarSign, PackageCheck, ShieldCheck, Store, Users } from 'lucide-react';
import PublicLayout from '../components/layout/PublicLayout';

interface HomePageProps {
  onOpenSimpleSignup?: () => void;
}

const storefronts = [
  {
    name: 'MareBelle',
    slug: 'marebelle',
    label: 'Equestrian beauty & lifestyle',
    image: '/marebelle-storefront-example.png',
    imageClass: 'object-cover object-top',
    surface: 'from-[#16120d] to-[#2b2116]',
  },
  {
    name: 'RedTail',
    slug: 'redtail',
    label: 'Automotive care & performance',
    image: '/redtail-editorial-hero.png',
    imageClass: 'object-cover object-top',
    surface: 'from-[#17090b] to-[#3a1115]',
  },
  {
    name: 'Loving Nutrition',
    slug: 'loving-nutrition',
    label: 'Nutrition & everyday wellness',
    image: '/loving-nutrition-logo.png',
    imageClass: 'object-contain p-5',
    surface: 'from-[#063c2f] to-[#0b5b43]',
  },
];

const roleCards = [
  {
    icon: Store,
    title: 'Sell your products',
    detail: 'Build a branded storefront, control pricing, and manage orders and fulfillment.',
  },
  {
    icon: BadgeDollarSign,
    title: 'Promote the marketplace',
    detail: 'Choose products, add them to your store, and share tracked single-item promotions.',
  },
  {
    icon: Users,
    title: 'Grow a business network',
    detail: 'Invite sellers and affiliates with lifetime influencer attribution on eligible sales.',
  },
];

const HomePageBZO: React.FC<HomePageProps> = ({ onOpenSimpleSignup }) => {
  const signupLink = (
    <Link
      to="/signup"
      onClick={(event) => {
        if (onOpenSimpleSignup) {
          event.preventDefault();
          onOpenSimpleSignup();
        }
      }}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ffcb05] px-6 py-3.5 text-sm font-black text-[#101820] shadow-[0_14px_35px_rgba(255,203,5,0.22)] transition hover:-translate-y-0.5 hover:bg-[#ffd83d]"
    >
      Start your business
      <ArrowRight className="h-4 w-4" />
    </Link>
  );

  return (
    <PublicLayout className="bzo-marketing-shell bg-[#071017] pb-24 text-white sm:pb-0">
      <div className="space-y-5 sm:space-y-8">
        <section className="relative isolate overflow-hidden rounded-[28px] border border-white/10 bg-[#0b151d] px-5 py-10 shadow-[0_40px_120px_rgba(0,0,0,0.35)] sm:px-8 sm:py-14 lg:px-14 lg:py-20">
          <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_15%_10%,rgba(255,203,5,0.18),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(16,185,129,0.16),transparent_30%),linear-gradient(135deg,#0b151d_0%,#071017_72%)]" />
          <div className="absolute -right-16 -top-16 -z-10 h-56 w-56 rounded-full border border-[#ffcb05]/20 sm:h-80 sm:w-80" />
          <div className="absolute -right-4 top-4 -z-10 h-36 w-36 rounded-full border border-white/10 sm:h-56 sm:w-56" />

          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#ffcb05]/30 bg-[#ffcb05]/10 px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.24em] text-[#ffda45]">
                One account. Three ways to grow.
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.045em] text-white sm:text-5xl lg:text-7xl">
                Build your brand. Sell your products. Promote others.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Beezio gives independent businesses a polished storefront, a product marketplace, tracked promotion tools, and one clear earnings dashboard—without monthly or listing fees.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                {signupLink}
                <Link
                  to="/marketplace"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold text-white transition hover:border-white/40 hover:bg-white/10"
                >
                  Explore the marketplace
                </Link>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Free business account</span>
                <span className="inline-flex items-center gap-2"><PackageCheck className="h-4 w-4 text-emerald-400" /> Storefront + promotion tools</span>
                <span className="inline-flex items-center gap-2"><BadgeDollarSign className="h-4 w-4 text-emerald-400" /> Itemized earnings</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[460px]">
              <div className="absolute -inset-5 rounded-[38px] bg-gradient-to-br from-[#ffcb05]/20 via-transparent to-emerald-400/15 blur-2xl" />
              <div className="relative overflow-hidden rounded-[30px] border border-white/15 bg-white/[0.06] p-3 shadow-2xl backdrop-blur">
                <div className="overflow-hidden rounded-[22px] border border-white/10 bg-gradient-to-br from-[#063c2f] to-[#0b5b43]">
                  <img src="/loving-nutrition-logo.png" alt="Loving Nutrition storefront logo" className="aspect-square w-full object-contain p-5" />
                </div>
                <div className="flex items-center justify-between gap-4 px-2 pb-1 pt-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#ffda45]">Powered by Beezio</div>
                    <div className="mt-1 text-lg font-black">Your brand can look like a real business.</div>
                  </div>
                  <img src="/bzobee.png" alt="Beezio bee" className="h-16 w-16 object-contain" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0c1720] py-8 sm:px-7 sm:py-10">
          <div className="px-5 sm:px-0">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#ffcb05]">Storefronts built on Beezio</p>
            <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <h2 className="max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl">See the business before reading the business model.</h2>
              <p className="max-w-md text-sm leading-6 text-slate-400">Each brand keeps its own look, slug, product collection, orders, and fulfillment details.</p>
            </div>
          </div>

          <div className="mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            {storefronts.map((storefront) => (
              <Link
                key={storefront.slug}
                to={`/store/${storefront.slug}`}
                className="group min-w-[82%] snap-center overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] transition hover:-translate-y-1 hover:border-white/25 sm:min-w-0"
              >
                <div className={`aspect-[4/3] overflow-hidden bg-gradient-to-br ${storefront.surface}`}>
                  <img src={storefront.image} alt={`${storefront.name} storefront`} className={`h-full w-full transition duration-500 group-hover:scale-[1.025] ${storefront.imageClass}`} />
                </div>
                <div className="flex items-center justify-between gap-3 p-5">
                  <div>
                    <div className="text-lg font-black text-white">{storefront.name}</div>
                    <div className="mt-1 text-sm text-slate-400">{storefront.label}</div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-[#ffcb05] transition group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white px-5 py-9 text-[#101820] shadow-xl sm:px-8 sm:py-12">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-700">Everything connects</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">One account can sell, promote, and recruit.</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">Use the tools you need today and add another income path whenever your business is ready.</p>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {roleCards.map(({ icon: Icon, title, detail }) => (
              <div key={title} className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#101820] text-[#ffcb05]"><Icon className="h-5 w-5" /></div>
                <h3 className="mt-5 text-lg font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-[#ffcb05]/20 bg-gradient-to-r from-[#13232e] to-[#0a171f] px-6 py-10 text-center sm:px-10 sm:py-14">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-[#ffcb05]">Start free</p>
          <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">Turn what you sell—and what you recommend—into one polished business.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">No monthly fee. No listing fee. Your storefront, marketplace tools, tracked links, and dashboards are included.</p>
          <div className="mt-7">{signupLink}</div>
        </section>
      </div>

      <div className="fixed inset-x-3 bottom-3 z-50 sm:hidden">
        <Link
          to="/signup"
          onClick={(event) => {
            if (onOpenSimpleSignup) {
              event.preventDefault();
              onOpenSimpleSignup();
            }
          }}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#ffcb05] px-6 py-4 text-sm font-black text-[#101820] shadow-[0_18px_45px_rgba(0,0,0,0.4)]"
        >
          Start your business <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </PublicLayout>
  );
};

export default HomePageBZO;
