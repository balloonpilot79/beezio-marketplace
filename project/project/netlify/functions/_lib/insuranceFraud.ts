import crypto from 'node:crypto';
import {
  INSURANCE_DEFAULT_DUPLICATE_WINDOW_DAYS,
  INSURANCE_DEFAULT_MAX_SUBMISSIONS_PER_DAY,
  INSURANCE_DEFAULT_MAX_SUBMISSIONS_PER_HOUR,
  INSURANCE_DEFAULT_MIN_COMPLETION_SECONDS,
  INSURANCE_SIMPLE_HUMAN_ANSWER,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
} from '../../../shared/insuranceLeads';

const sha256 = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

export type InsuranceFraudAnalysisInput = {
  supabaseAdmin: any;
  campaignId: string;
  affiliateId: string | null;
  email: string;
  phone: string;
  ipAddress: string;
  userAgent: string;
  formStartedAt: string | null;
  submittedAt: string;
  honeypotValue: string;
  humanCheckAnswer: string;
};

export type InsuranceFraudAnalysisResult = {
  duplicateHash: string;
  normalizedEmail: string;
  normalizedPhone: string;
  ipHash: string;
  completionSeconds: number | null;
  fraudScore: number;
  fraudFlags: string[];
  reviewStatus: 'auto_approved' | 'flagged' | 'rejected';
  status: 'submitted' | 'invalid';
  statusReason: string | null;
  isDuplicate: boolean;
  duplicateLeadId: string | null;
  antiBotPassed: boolean;
};

export async function analyzeInsuranceLeadFraud(input: InsuranceFraudAnalysisInput): Promise<InsuranceFraudAnalysisResult> {
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhone = normalizePhone(input.phone);
  const ipHash = sha256(String(input.ipAddress || 'unknown').trim() || 'unknown');
  const duplicateHash = sha256(`${input.campaignId}:${normalizedEmail}:${normalizedPhone}`);
  const fraudFlags: string[] = [];
  let fraudScore = 0;
  let reviewStatus: InsuranceFraudAnalysisResult['reviewStatus'] = 'auto_approved';
  let status: InsuranceFraudAnalysisResult['status'] = 'submitted';
  let statusReason: string | null = null;
  let duplicateLeadId: string | null = null;
  let isDuplicate = false;

  if (!isValidEmail(normalizedEmail)) {
    fraudFlags.push('invalid_email');
    fraudScore += 100;
  }
  if (!isValidPhone(normalizedPhone)) {
    fraudFlags.push('invalid_phone');
    fraudScore += 100;
  }

  const honeypotValue = String(input.honeypotValue || '').trim();
  if (honeypotValue) {
    fraudFlags.push('honeypot_triggered');
    fraudScore += 200;
  }

  const antiBotPassed = String(input.humanCheckAnswer || '').trim().toLowerCase() === INSURANCE_SIMPLE_HUMAN_ANSWER;
  if (!antiBotPassed) {
    fraudFlags.push('human_check_failed');
    fraudScore += 80;
  }

  let completionSeconds: number | null = null;
  const startedAt = input.formStartedAt ? new Date(input.formStartedAt) : null;
  const submittedAt = new Date(input.submittedAt);
  if (startedAt && !Number.isNaN(startedAt.getTime()) && !Number.isNaN(submittedAt.getTime())) {
    completionSeconds = Math.max(0, Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000));
    if (completionSeconds < INSURANCE_DEFAULT_MIN_COMPLETION_SECONDS) {
      fraudFlags.push('submitted_too_fast');
      fraudScore += 45;
    }
  }

  const duplicateWindowStart = new Date(submittedAt.getTime() - INSURANCE_DEFAULT_DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const oneHourWindow = new Date(submittedAt.getTime() - 60 * 60 * 1000).toISOString();
  const oneDayWindow = new Date(submittedAt.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: duplicateRows } = await input.supabaseAdmin
    .from('insurance_leads')
    .select('id,email,phone,ip_hash,created_at')
    .eq('campaign_id', input.campaignId)
    .gte('created_at', duplicateWindowStart)
    .or(`duplicate_hash.eq.${duplicateHash},email.eq.${normalizedEmail},phone.eq.${normalizedPhone}`);

  if (Array.isArray(duplicateRows) && duplicateRows.length > 0) {
    isDuplicate = true;
    duplicateLeadId = String((duplicateRows[0] as any)?.id || '').trim() || null;
    fraudFlags.push('duplicate_contact');
    fraudScore += 160;
  }

  const { count: hourlyIpCount } = await input.supabaseAdmin
    .from('insurance_leads')
    .select('id', { count: 'exact', head: true })
    .eq('submitted_ip_hash', ipHash)
    .gte('created_at', oneHourWindow);
  if ((hourlyIpCount || 0) >= INSURANCE_DEFAULT_MAX_SUBMISSIONS_PER_HOUR) {
    fraudFlags.push('ip_hourly_rate_limit');
    fraudScore += 90;
  }

  const { count: dailyIpCount } = await input.supabaseAdmin
    .from('insurance_leads')
    .select('id', { count: 'exact', head: true })
    .eq('submitted_ip_hash', ipHash)
    .gte('created_at', oneDayWindow);
  if ((dailyIpCount || 0) >= INSURANCE_DEFAULT_MAX_SUBMISSIONS_PER_DAY) {
    fraudFlags.push('ip_daily_rate_limit');
    fraudScore += 120;
  }

  if (input.affiliateId) {
    const { count: affiliateDailyCount } = await input.supabaseAdmin
      .from('insurance_leads')
      .select('id', { count: 'exact', head: true })
      .eq('affiliate_user_id', input.affiliateId)
      .eq('status', 'delivered')
      .gte('created_at', oneDayWindow);

    const { data: affiliateProfile } = await input.supabaseAdmin
      .from('insurance_affiliate_profiles')
      .select('daily_valid_lead_cap,trust_tier')
      .eq('affiliate_user_id', input.affiliateId)
      .maybeSingle();

    const trustTier = String((affiliateProfile as any)?.trust_tier || 'new').trim().toLowerCase();
    const dailyValidLeadCap = Number((affiliateProfile as any)?.daily_valid_lead_cap || 0) || 0;
    const cap = dailyValidLeadCap > 0 ? dailyValidLeadCap : INSURANCE_DEFAULT_MAX_SUBMISSIONS_PER_DAY;
    if (trustTier === 'new' && (affiliateDailyCount || 0) >= cap) {
      fraudFlags.push('affiliate_daily_cap_reached');
      fraudScore += 90;
    }

    const { data: clickRows } = await input.supabaseAdmin
      .from('insurance_affiliate_clicks')
      .select('id,click_ip_hash,created_at')
      .eq('affiliate_user_id', input.affiliateId)
      .gte('created_at', oneDayWindow)
      .eq('click_ip_hash', ipHash)
      .limit(3);
    if (Array.isArray(clickRows) && clickRows.length > 0) {
      fraudFlags.push('affiliate_ip_match');
      fraudScore += 55;
    }
  }

  if (fraudScore >= 180) {
    reviewStatus = 'rejected';
    status = 'invalid';
    statusReason = fraudFlags[0] || 'fraud_rejected';
  } else if (fraudScore >= 60) {
    reviewStatus = 'flagged';
    statusReason = fraudFlags[0] || 'manual_review_required';
  }

  return {
    duplicateHash,
    normalizedEmail,
    normalizedPhone,
    ipHash,
    completionSeconds,
    fraudScore,
    fraudFlags,
    reviewStatus,
    status,
    statusReason,
    isDuplicate,
    duplicateLeadId,
    antiBotPassed,
  };
}
