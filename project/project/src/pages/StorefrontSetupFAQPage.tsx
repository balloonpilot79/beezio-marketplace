import React from 'react';
import { CheckCircle2, ExternalLink, Globe2, Image, LayoutTemplate, PackagePlus, Palette, Share2, Sparkles, Store } from 'lucide-react';
import { Link } from 'react-router-dom';

const steps = [
  { icon: Store, title: 'Create your brand storefront', body: 'Open Brand storefronts in your dashboard. A standard account receives one complete brand storefront. Approved Beezio administrators can switch between brands such as MareBelle and RedTail. Every brand keeps its own slug, design, products, domain, and social links.' },
  { icon: Palette, title: 'Choose a clear visual direction', body: 'Pick two main colors and one accent color. Use a dark color for headings and buttons, a light background, and the accent for small highlights. High contrast keeps the storefront easy to read.' },
  { icon: Image, title: 'Add a logo and banner', body: 'Use a square logo and a wide, uncluttered banner. Choose images that belong to the same brand and color family. Preview the mobile storefront before publishing.' },
  { icon: LayoutTemplate, title: 'Write the brand story', body: 'In two or three sentences, explain who the brand serves, what it offers, and why it is different. Add shipping and return information so shoppers know what to expect.' },
  { icon: PackagePlus, title: 'Place products deliberately', body: 'When creating a product, select the exact brand storefronts where it belongs. Marketplace products can also be added to the appropriate store. A product never needs to appear in every brand.' },
  { icon: Share2, title: 'Connect official social channels', body: 'Add the brand website, Facebook, Instagram, X, LinkedIn, TikTok, or YouTube links. Each storefront has its own social settings, so RedTail links do not appear on MareBelle.' },
  { icon: Globe2, title: 'Use the slug or connect a domain', body: 'The Beezio slug works immediately. If the brand owns a domain, save it on that storefront and follow the DNS guide. The slug remains available while DNS and HTTPS finish updating.' },
  { icon: CheckCircle2, title: 'Run the launch check', body: 'Open the public store on desktop and mobile. Check every link, image, policy, product, price, social profile, contact button, and checkout path before sharing it.' },
];

const StorefrontSetupFAQPage: React.FC = () => (
  <main className="min-h-screen bg-slate-50 text-slate-950">
    <section className="overflow-hidden border-b border-slate-200 bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-amber-300"><Sparkles className="h-4 w-4" /> Beezio storefront guide</div>
        <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">Build a storefront that looks like a real brand—not a generic template.</h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 md:text-lg">Follow these steps to create a polished Beezio slug storefront like MareBelle or RedTail. You do not need design or coding experience.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/dashboard" className="rounded-full bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300">Open my dashboard</Link>
          <Link to="/faq/custom-domains" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">Custom-domain instructions <ExternalLink className="h-4 w-4" /></Link>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      <div className="grid gap-5 md:grid-cols-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <article key={step.title} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white"><Icon className="h-5 w-5" /></div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">Step {index + 1}</div>
                  <h2 className="mt-1 text-xl font-black">{step.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[32px] border border-amber-200 bg-amber-50 p-7">
          <h2 className="text-2xl font-black">The simple design formula</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              'One clear brand name and short promise',
              'One square logo and one strong banner',
              'Two main colors plus one accent',
              'Short sections with readable contrast',
              'Only products that fit this brand',
              'Real policies, contact details, and social links',
            ].map((item) => <div key={item} className="flex items-start gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {item}</div>)}
          </div>
        </section>

        <aside className="rounded-[32px] bg-slate-900 p-7 text-white">
          <h2 className="text-2xl font-black">Before you publish</h2>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
            <li>• Preview the storefront at its Beezio slug.</li>
            <li>• Confirm the brand name, story, colors, and images.</li>
            <li>• Test every social link in a new tab.</li>
            <li>• Test the custom domain and keep the slug as a backup.</li>
            <li>• Verify products belong to the correct brand.</li>
            <li>• Send a test message through the contact button.</li>
          </ul>
          <Link to="/contact-support" className="mt-6 inline-flex rounded-full bg-white px-4 py-2.5 text-sm font-bold text-slate-950">Ask Beezio support</Link>
        </aside>
      </div>

      <section className="mt-8 rounded-[32px] border border-slate-200 bg-white p-7">
        <h2 className="text-2xl font-black">Can I run more than one brand?</h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">A standard Beezio login includes one brand storefront so its products, customers, payouts, and support stay clear. Beezio administrators may operate approved brands from one account temporarily. If a brand later receives its own business email, Beezio support can transfer that storefront to the new account without rebuilding its slug, design, or product placement.</p>
      </section>
    </section>
  </main>
);

export default StorefrontSetupFAQPage;
