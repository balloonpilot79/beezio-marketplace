import ChatSupportDashboard from '../components/ChatSupportDashboard';
import IssueCenterPage from './IssueCenterPage';

export default function SupportOperationsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-6">
            <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-900">
              Support Operations
            </span>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Beezio support workspace</h1>
            <p className="max-w-3xl text-sm text-slate-600 sm:text-base">
              This workspace is limited to customer support, disputes, refunds, and live support activity. It does not expose the broader admin finance or platform controls.
            </p>
          </div>

          <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
            <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <IssueCenterPage embedded isAdminOverride />
            </div>
            <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <ChatSupportDashboard canManageSupport />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}