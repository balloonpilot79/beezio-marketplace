import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PublicLayout from '../components/layout/PublicLayout';

const guides = [
  { title: 'Orders and support', detail: 'Sign in to view purchases, receipts, tracking, and order support.', href: '/account?tab=orders' },
  { title: 'Shipping', detail: 'Check shipping costs, delivery estimates, and how to get help with a shipment.', href: '/shipping' },
  { title: 'Returns and refunds', detail: 'Learn about the 14-day return window and how to request help.', href: '/returns' },
  { title: 'Payouts', detail: 'Review the 14-day hold, $5 minimum, PayPal setup, and payout schedule.', href: '/legal/payout-policy' },
  { title: 'Store setup', detail: 'Get help with branding, product collections, layouts, and custom domains.', href: '/faq/storefronts' },
  { title: 'Frequently asked questions', detail: 'Find answers about accounts, selling, affiliates, and using Beezio.', href: '/faq' },
];

export default function HelpCenterPage() {
  return (
    <PublicLayout>
      <header className="max-w-2xl">
        <p className="bz-eyebrow">Beezio support</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">Help Center</h1>
        <p className="mt-5 leading-7 text-slate-600">Find help with shopping, your store, referrals, and payouts.</p>
      </header>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {guides.map(guide => (
          <Link key={guide.href} to={guide.href} className="bz-panel p-6 transition-shadow hover:shadow-lg">
            <h2 className="text-xl font-semibold">{guide.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{guide.detail}</p>
            <span className="bz-text-link mt-5">Open guide <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
          </Link>
        ))}
      </div>
      <section className="bz-panel mt-8 p-6 sm:p-8">
        <h2 className="text-2xl font-semibold">Need more help?</h2>
        <p className="mt-3 leading-7 text-slate-600">For order questions, include your order number when you contact the seller or Beezio support.</p>
        <div className="mt-5 flex flex-wrap gap-4">
          <Link to="/contact" className="bz-button bz-button-gold">Contact support</Link>
          <a href="mailto:support@beezio.co" className="bz-button bz-button-outline">Email support@beezio.co</a>
        </div>
      </section>
    </PublicLayout>
  );
}
