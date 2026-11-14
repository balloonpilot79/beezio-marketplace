import InfluencerDashboard from './InfluencerDashboard';
import AccountPayoutDashboard from './AccountPayoutDashboard';

export default function BuyerAmbassadorPanel() {
  return (
    <section aria-label="Buyer ambassador rewards" className="min-w-0 space-y-6">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-800">Beezio Ambassadors</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Refer people. Earn rewards.</h2>
        <p className="mt-3 text-sm leading-6 text-slate-800">Your buyer account can earn the same referral rewards as a business ambassador. Share one invite with shoppers, store owners, and affiliates.</p>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-800">
          <li><strong>Refer buyers:</strong> earn rewards on their qualifying purchases.</li>
          <li><strong>Refer sellers:</strong> earn the established ambassador reward on their qualifying sales.</li>
          <li><strong>Refer affiliates:</strong> earn the established ambassador reward on their qualifying referred sales.</li>
        </ul>
        <p className="mt-4 text-sm text-slate-700">Shopping and referrals stay in this account. No store or business setup is required. Rewards depend on qualifying transactions, not signups or your own purchases.</p>
      </div>
      <InfluencerDashboard buyerView />
      <AccountPayoutDashboard ambassadorOnly />
    </section>
  );
}
