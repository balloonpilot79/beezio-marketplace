import { useEffect, useMemo, useState } from 'react';
import { FileCheck2, ShieldCheck } from 'lucide-react';
import {
  TAX_COMPLIANCE_VERSION,
  appendTaxAgreements,
  formatTaxMoney,
  getCurrentTaxYear,
  getTaxComplianceProfile,
  getUserTaxReports,
  isTaxComplianceTableMissing,
  maskTaxIdLast4,
  type Tax1099Report,
  type TaxClassification,
  type TaxComplianceProfile,
  type TaxFormStatus,
  type TaxFormType,
  upsertTaxComplianceProfile,
} from '../services/taxCompliance';

interface TaxComplianceCardProps {
  userId: string;
  defaultFullName?: string | null;
  defaultEmail?: string | null;
  defaultStreetAddress?: string | null;
  defaultCity?: string | null;
  defaultState?: string | null;
  defaultPostalCode?: string | null;
  paidThisYearCents?: number;
}

type FormState = {
  legal_name: string;
  business_name: string;
  tax_classification: TaxClassification | '';
  form_type: TaxFormType;
  form_status: TaxFormStatus;
  tax_id_last4: string;
  delivery_email: string;
  street_address: string;
  city: string;
  state_region: string;
  postal_code: string;
  country: string;
  certification_name: string;
  independent_contractor_ack: boolean;
  electronic_delivery_ack: boolean;
  backup_withholding_ack: boolean;
};

const taxClassifications: Array<{ value: TaxClassification; label: string }> = [
  { value: 'individual', label: 'Individual' },
  { value: 'sole_proprietor', label: 'Sole proprietor' },
  { value: 'single_member_llc', label: 'Single-member LLC' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'c_corp', label: 'C corporation' },
  { value: 's_corp', label: 'S corporation' },
  { value: 'non_us_individual', label: 'Non-US individual' },
  { value: 'non_us_business', label: 'Non-US business' },
];

const formTypeOptions: Array<{ value: TaxFormType; label: string }> = [
  { value: 'none', label: 'Not started yet' },
  { value: 'w9', label: 'W-9 ready for US contractor reporting' },
  { value: 'w8-ben', label: 'W-8BEN for non-US individual' },
  { value: 'w8-bene', label: 'W-8BEN-E for non-US business' },
];

const formStatusOptions: Array<{ value: TaxFormStatus; label: string }> = [
  { value: 'missing', label: 'Missing' },
  { value: 'pending', label: 'Working on it' },
  { value: 'submitted', label: 'Submitted to Beezio' },
  { value: 'verified', label: 'Verified' },
  { value: 'needs_attention', label: 'Needs attention' },
];

const buildInitialState = (props: TaxComplianceCardProps, profile?: TaxComplianceProfile | null): FormState => ({
  legal_name: String(profile?.legal_name || props.defaultFullName || ''),
  business_name: String(profile?.business_name || ''),
  tax_classification: (profile?.tax_classification || '') as TaxClassification | '',
  form_type: profile?.form_type || 'none',
  form_status: profile?.form_status || 'missing',
  tax_id_last4: String(profile?.tax_id_last4 || ''),
  delivery_email: String(profile?.delivery_email || props.defaultEmail || ''),
  street_address: String(profile?.street_address || props.defaultStreetAddress || ''),
  city: String(profile?.city || props.defaultCity || ''),
  state_region: String(profile?.state_region || props.defaultState || ''),
  postal_code: String(profile?.postal_code || props.defaultPostalCode || ''),
  country: String(profile?.country || 'US'),
  certification_name: String(profile?.certification_name || props.defaultFullName || ''),
  independent_contractor_ack: Boolean(profile?.independent_contractor_ack_at),
  electronic_delivery_ack: Boolean(profile?.electronic_delivery_ack_at),
  backup_withholding_ack: Boolean(profile?.backup_withholding_ack),
});

export default function TaxComplianceCard(props: TaxComplianceCardProps) {
  const { userId, paidThisYearCents = 0 } = props;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<TaxComplianceProfile | null>(null);
  const [reports, setReports] = useState<Tax1099Report[]>([]);
  const [form, setForm] = useState<FormState>(() => buildInitialState(props, null));

  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setMigrationNeeded(false);
      try {
        const [nextProfile, nextReports] = await Promise.all([
          getTaxComplianceProfile(userId),
          getUserTaxReports(userId),
        ]);

        if (!alive) return;
        setProfile(nextProfile);
        setReports(nextReports);
        setForm(buildInitialState(props, nextProfile));
      } catch (loadError: any) {
        if (!alive) return;
        if (isTaxComplianceTableMissing(loadError)) {
          setMigrationNeeded(true);
          setProfile(null);
          setReports([]);
          setForm(buildInitialState(props, null));
        } else {
          setError(loadError?.message || 'Unable to load tax compliance.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, [props, userId]);

  const missingChecklist = useMemo(() => {
    const items: string[] = [];
    if (!form.independent_contractor_ack) items.push('Independent contractor acknowledgement');
    if (!form.legal_name.trim()) items.push('Legal name');
    if (!form.delivery_email.trim()) items.push('Tax delivery email');
    if (form.form_type === 'none') items.push('Tax form selection');
    if (!form.certification_name.trim()) items.push('Certification signature name');
    if (form.form_type !== 'none' && form.form_status === 'missing') items.push('Tax form progress');
    return items;
  }, [form]);

  const badgeTone = migrationNeeded
    ? 'bg-amber-100 text-amber-900'
    : missingChecklist.length
    ? 'bg-red-100 text-red-800'
    : profile?.form_status === 'verified'
    ? 'bg-emerald-100 text-emerald-800'
    : 'bg-blue-100 text-blue-800';

  const badgeLabel = migrationNeeded
    ? 'Migration needed'
    : missingChecklist.length
    ? 'Action needed'
    : profile?.form_status === 'verified'
    ? 'Verified'
    : 'In progress';

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    if (!form.independent_contractor_ack) {
      setSaving(false);
      setError('You must acknowledge that Beezio business users are independent contractors, not employees.');
      return;
    }

    if (!form.legal_name.trim()) {
      setSaving(false);
      setError('Legal name is required for tax compliance.');
      return;
    }

    if (!form.delivery_email.trim() || !form.delivery_email.includes('@')) {
      setSaving(false);
      setError('Enter a valid email for tax delivery and reporting.');
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const agreements = [];
      if (form.independent_contractor_ack && !profile?.independent_contractor_ack_at) {
        agreements.push({
          user_id: userId,
          agreement_type: 'independent_contractor' as const,
          document_version: TAX_COMPLIANCE_VERSION,
          details: { source: 'dashboard' },
        });
      }
      if (form.electronic_delivery_ack && !profile?.electronic_delivery_ack_at) {
        agreements.push({
          user_id: userId,
          agreement_type: 'electronic_delivery' as const,
          document_version: TAX_COMPLIANCE_VERSION,
          details: { source: 'dashboard' },
        });
      }
      if (form.backup_withholding_ack && !profile?.backup_withholding_ack) {
        agreements.push({
          user_id: userId,
          agreement_type: 'backup_withholding' as const,
          document_version: TAX_COMPLIANCE_VERSION,
          details: { source: 'dashboard' },
        });
      }

      const nextProfile = await upsertTaxComplianceProfile(userId, {
        legal_name: form.legal_name.trim(),
        business_name: form.business_name.trim() || null,
        tax_classification: (form.tax_classification || null) as TaxClassification | null,
        form_type: form.form_type,
        form_status: form.form_status,
        tax_id_last4: form.tax_id_last4.replace(/\D/g, '').slice(-4) || null,
        delivery_email: form.delivery_email.trim(),
        street_address: form.street_address.trim() || null,
        city: form.city.trim() || null,
        state_region: form.state_region.trim() || null,
        postal_code: form.postal_code.trim() || null,
        country: form.country.trim() || 'US',
        tax_country: form.country.trim() || 'US',
        certification_name: form.certification_name.trim() || form.legal_name.trim(),
        certification_signed_at: nowIso,
        independent_contractor_ack_at: form.independent_contractor_ack ? profile?.independent_contractor_ack_at || nowIso : null,
        independent_contractor_version: form.independent_contractor_ack ? TAX_COMPLIANCE_VERSION : null,
        electronic_delivery_ack_at: form.electronic_delivery_ack ? profile?.electronic_delivery_ack_at || nowIso : null,
        backup_withholding_ack: form.backup_withholding_ack,
        ytd_paid_cents: paidThisYearCents,
      });

      if (agreements.length) {
        await appendTaxAgreements(agreements);
      }

      setProfile(nextProfile);
      setSuccess('Tax compliance details saved.');
    } catch (saveError: any) {
      if (isTaxComplianceTableMissing(saveError)) {
        setMigrationNeeded(true);
        setError('Tax compliance tables are not available yet. Apply the latest Supabase migration, then save again.');
      } else {
        setError(saveError?.message || 'Unable to save tax compliance.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">Tax Compliance</h3>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${badgeTone}`}>
              {badgeLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Beezio business users are treated as independent contractors. Keep your tax identity, acknowledgements, and year-end reporting status current here.
          </p>
        </div>
        <ShieldCheck className="h-6 w-6 text-amber-600" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">What this covers</p>
            <p className="mt-2">
              This record is used for contractor acknowledgement, W-9 or W-8 readiness, payout reporting, and year-end 1099 preparation when required.
            </p>
          </div>

          {migrationNeeded ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Apply Supabase migration <span className="font-semibold">20260330090000_tax_compliance.sql</span> before saving user tax records.
            </div>
          ) : null}

          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Legal name</label>
              <input
                type="text"
                value={form.legal_name}
                onChange={(event) => handleChange('legal_name', event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Business name</label>
              <input
                type="text"
                value={form.business_name}
                onChange={(event) => handleChange('business_name', event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Tax classification</label>
              <select
                value={form.tax_classification}
                onChange={(event) => handleChange('tax_classification', event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
              >
                <option value="">Select one</option>
                {taxClassifications.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Tax delivery email</label>
              <input
                type="email"
                value={form.delivery_email}
                onChange={(event) => handleChange('delivery_email', event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Tax form</label>
              <select
                value={form.form_type}
                onChange={(event) => handleChange('form_type', event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
              >
                {formTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Form status</label>
              <select
                value={form.form_status}
                onChange={(event) => handleChange('form_status', event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
              >
                {formStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Tax ID last 4</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={form.tax_id_last4}
                onChange={(event) => handleChange('tax_id_last4', event.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Certification name</label>
              <input
                type="text"
                value={form.certification_name}
                onChange={(event) => handleChange('certification_name', event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">Street address</label>
              <input
                type="text"
                value={form.street_address}
                onChange={(event) => handleChange('street_address', event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(event) => handleChange('city', event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">State / region</label>
              <input
                type="text"
                value={form.state_region}
                onChange={(event) => handleChange('state_region', event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Postal code</label>
              <input
                type="text"
                value={form.postal_code}
                onChange={(event) => handleChange('postal_code', event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Country</label>
              <input
                type="text"
                value={form.country}
                onChange={(event) => handleChange('country', event.target.value.toUpperCase())}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={form.independent_contractor_ack}
                onChange={(event) => handleChange('independent_contractor_ack', event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span>I understand I am operating on Beezio as an independent contractor and not as an employee of Beezio.</span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={form.electronic_delivery_ack}
                onChange={(event) => handleChange('electronic_delivery_ack', event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span>I agree that Beezio can deliver tax forms, notices, and payout reporting to my dashboard and email.</span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={form.backup_withholding_ack}
                onChange={(event) => handleChange('backup_withholding_ack', event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span>I understand Beezio may place holds or request corrected tax information before releasing payouts when records are incomplete.</span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-[#101820] disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save tax compliance'}
            </button>
            <span className="text-xs text-gray-500">Version {TAX_COMPLIANCE_VERSION}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{getCurrentTaxYear()} paid through Beezio</p>
            <p className="mt-2 text-2xl font-bold text-emerald-950">{formatTaxMoney(paidThisYearCents)}</p>
            <p className="mt-1 text-sm text-emerald-900">Use this as your platform payout snapshot while Beezio prepares year-end reporting.</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-semibold text-gray-900">Compliance checklist</p>
            </div>
            {loading ? (
              <p className="mt-3 text-sm text-gray-500">Loading...</p>
            ) : missingChecklist.length ? (
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                {missingChecklist.map((item) => (
                  <li key={item} className="rounded-md border border-red-100 bg-red-50 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Your contractor acknowledgement and tax profile are on file.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">Current record</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Form status</span>
                <span className="font-medium text-gray-900">{profile?.form_status || form.form_status}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Form type</span>
                <span className="font-medium text-gray-900">{profile?.form_type || form.form_type}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Tax ID on file</span>
                <span className="font-medium text-gray-900">{maskTaxIdLast4(profile?.tax_id_last4 || form.tax_id_last4)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Last 1099 year</span>
                <span className="font-medium text-gray-900">{profile?.last_1099_tax_year || 'Not issued yet'}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">1099 history</p>
            {reports.length ? (
              <div className="mt-3 space-y-2">
                {reports.map((report) => (
                  <div key={report.id} className="rounded-md border border-gray-100 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-gray-900">{report.tax_year}</span>
                      <span className="text-xs uppercase tracking-wide text-gray-500">{report.status}</span>
                    </div>
                    <div className="mt-1 text-gray-600">{formatTaxMoney(report.gross_payout_cents)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-gray-500">No 1099 reports have been issued yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}