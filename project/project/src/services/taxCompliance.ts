import { supabase } from '../lib/supabase';

export type TaxFormStatus = 'missing' | 'pending' | 'submitted' | 'verified' | 'needs_attention';
export type TaxFormType = 'none' | 'w9' | 'w8-ben' | 'w8-bene';
export type TaxClassification =
  | 'individual'
  | 'sole_proprietor'
  | 'single_member_llc'
  | 'partnership'
  | 'c_corp'
  | 's_corp'
  | 'non_us_individual'
  | 'non_us_business';
export type AdminReviewStatus = 'not_reviewed' | 'ready' | 'needs_follow_up' | 'filed';
export type TaxAgreementType = 'independent_contractor' | 'electronic_delivery' | 'backup_withholding';

export interface TaxComplianceProfile {
  user_id: string;
  legal_name: string | null;
  business_name: string | null;
  tax_classification: TaxClassification | null;
  tax_country: string;
  form_status: TaxFormStatus;
  form_type: TaxFormType;
  tax_id_last4: string | null;
  delivery_email: string | null;
  street_address: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  independent_contractor_ack_at: string | null;
  independent_contractor_version: string | null;
  electronic_delivery_ack_at: string | null;
  backup_withholding_ack: boolean;
  certification_signed_at: string | null;
  certification_name: string | null;
  ytd_paid_cents: number;
  last_1099_tax_year: number | null;
  last_1099_issued_at: string | null;
  admin_review_status: AdminReviewStatus;
  admin_notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TaxAgreementAuditRow {
  id?: string;
  user_id: string;
  agreement_type: TaxAgreementType;
  document_version: string;
  accepted_at?: string;
  details?: Record<string, unknown> | null;
}

export interface Tax1099Report {
  id: string;
  user_id: string;
  tax_year: number;
  gross_payout_cents: number;
  status: 'draft' | 'prepared' | 'issued' | 'delivered';
  document_url: string | null;
  issued_at: string | null;
  created_at: string;
}

export const TAX_COMPLIANCE_VERSION = '2026.03';

const TAX_PROFILE_COLUMNS = [
  'user_id',
  'legal_name',
  'business_name',
  'tax_classification',
  'tax_country',
  'form_status',
  'form_type',
  'tax_id_last4',
  'delivery_email',
  'street_address',
  'city',
  'state_region',
  'postal_code',
  'country',
  'independent_contractor_ack_at',
  'independent_contractor_version',
  'electronic_delivery_ack_at',
  'backup_withholding_ack',
  'certification_signed_at',
  'certification_name',
  'ytd_paid_cents',
  'last_1099_tax_year',
  'last_1099_issued_at',
  'admin_review_status',
  'admin_notes',
  'created_at',
  'updated_at',
].join(',');

const TAX_REPORT_COLUMNS = [
  'id',
  'user_id',
  'tax_year',
  'gross_payout_cents',
  'status',
  'document_url',
  'issued_at',
  'created_at',
].join(',');

const emptyProfile = (userId: string): TaxComplianceProfile => ({
  user_id: userId,
  legal_name: null,
  business_name: null,
  tax_classification: null,
  tax_country: 'US',
  form_status: 'missing',
  form_type: 'none',
  tax_id_last4: null,
  delivery_email: null,
  street_address: null,
  city: null,
  state_region: null,
  postal_code: null,
  country: 'US',
  independent_contractor_ack_at: null,
  independent_contractor_version: null,
  electronic_delivery_ack_at: null,
  backup_withholding_ack: false,
  certification_signed_at: null,
  certification_name: null,
  ytd_paid_cents: 0,
  last_1099_tax_year: null,
  last_1099_issued_at: null,
  admin_review_status: 'not_reviewed',
  admin_notes: null,
});

const normalizeProfile = (userId: string, row: Partial<TaxComplianceProfile> | null | undefined): TaxComplianceProfile => {
  const base = emptyProfile(userId);
  return {
    ...base,
    ...row,
    user_id: userId,
    tax_country: String(row?.tax_country || base.tax_country),
    form_status: (row?.form_status || base.form_status) as TaxFormStatus,
    form_type: (row?.form_type || base.form_type) as TaxFormType,
    country: String(row?.country || base.country),
    backup_withholding_ack: Boolean(row?.backup_withholding_ack),
    ytd_paid_cents: Number(row?.ytd_paid_cents || 0),
    admin_review_status: (row?.admin_review_status || base.admin_review_status) as AdminReviewStatus,
  };
};

export const isTaxComplianceTableMissing = (error: unknown) => {
  const message = String((error as any)?.message || '').toLowerCase();
  return message.includes('tax_profiles') || message.includes('tax_agreements') || message.includes('tax_1099_reports');
};

export async function getTaxComplianceProfile(userId: string): Promise<TaxComplianceProfile> {
  if (!userId) throw new Error('Missing user id.');

  const { data, error } = await supabase
    .from('tax_profiles')
    .select(TAX_PROFILE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isTaxComplianceTableMissing(error)) {
      return emptyProfile(userId);
    }
    throw error;
  }

  return normalizeProfile(userId, (data as Partial<TaxComplianceProfile> | null) || null);
}

export async function upsertTaxComplianceProfile(
  userId: string,
  patch: Partial<TaxComplianceProfile>
): Promise<TaxComplianceProfile> {
  if (!userId) throw new Error('Missing user id.');

  const payload = {
    ...patch,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('tax_profiles')
    .upsert(payload as never, { onConflict: 'user_id' })
    .select(TAX_PROFILE_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  return normalizeProfile(userId, (data as Partial<TaxComplianceProfile> | null) || payload);
}

export async function appendTaxAgreements(rows: TaxAgreementAuditRow[]): Promise<void> {
  if (!rows.length) return;

  const payload = rows.map((row) => ({
    user_id: row.user_id,
    agreement_type: row.agreement_type,
    document_version: row.document_version,
    accepted_at: row.accepted_at || new Date().toISOString(),
    details: row.details || null,
  }));

  const { error } = await supabase.from('tax_agreements').insert(payload as never);
  if (error) throw error;
}

export async function getUserTaxReports(userId: string): Promise<Tax1099Report[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('tax_1099_reports')
    .select(TAX_REPORT_COLUMNS)
    .eq('user_id', userId)
    .order('tax_year', { ascending: false });

  if (error) {
    if (isTaxComplianceTableMissing(error)) return [];
    throw error;
  }

  return ((data as Tax1099Report[]) || []).map((row) => ({
    ...row,
    gross_payout_cents: Number(row.gross_payout_cents || 0),
  }));
}

export function formatTaxMoney(cents: number) {
  return (Number(cents || 0) / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
  });
}

export function maskTaxIdLast4(value: string | null | undefined) {
  const digits = String(value || '').replace(/\D/g, '').slice(-4);
  return digits ? `***-${digits}` : 'Not provided';
}

export function buildTaxCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return '';
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => escape(row[header])).join(','));
  });
  return lines.join('\n');
}

export function getCurrentTaxYear() {
  return new Date().getFullYear();
}
