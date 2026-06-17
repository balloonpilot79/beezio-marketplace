import { createSupabaseAdmin } from './supabase';

const normalizePhone = (value: unknown): string =>
  String(value || '').replace(/\D+/g, '').slice(-10);

const toE164 = (value: unknown): string => {
  const digits = normalizePhone(value);
  if (!digits) return '';
  return digits.startsWith('1') && digits.length === 11 ? `+${digits}` : `+1${digits}`;
};

const twilioAuthHeader = () => {
  const sid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  if (!sid || !token) return null;
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
};

const twilioVerifyServiceSid = () => String(process.env.TWILIO_VERIFY_SERVICE_SID || '').trim();

export async function startInsurancePhoneVerification(phone: string) {
  const supabaseAdmin = createSupabaseAdmin();
  const phoneNormalized = normalizePhone(phone);
  const phoneE164 = toE164(phone);
  if (!phoneNormalized || phoneNormalized.length !== 10) {
    throw new Error('A valid US phone number is required.');
  }

  const authHeader = twilioAuthHeader();
  const serviceSid = twilioVerifyServiceSid();
  if (!authHeader || !serviceSid) {
    throw new Error('Twilio Verify is not configured.');
  }

  const body = new URLSearchParams();
  body.set('To', phoneE164);
  body.set('Channel', 'sms');

  const res = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const payload: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(payload?.message || 'Unable to start phone verification.'));
  }

  const { data, error } = await supabaseAdmin
    .from('insurance_phone_verifications')
    .insert({
      phone_e164: phoneE164,
      phone_normalized: phoneNormalized,
      status: 'pending',
      twilio_sid: String(payload?.sid || ''),
      verification_channel: 'sms',
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      metadata: {
        service_sid: serviceSid,
        to: phoneE164,
      },
    })
    .select('*')
    .single();
  if (error) throw error;

  return data;
}

export async function checkInsurancePhoneVerification(verificationId: string, code: string) {
  const supabaseAdmin = createSupabaseAdmin();
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('insurance_phone_verifications')
    .select('*')
    .eq('id', verificationId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error('Verification not found.');

  const authHeader = twilioAuthHeader();
  const serviceSid = twilioVerifyServiceSid();
  if (!authHeader || !serviceSid) {
    throw new Error('Twilio Verify is not configured.');
  }

  const body = new URLSearchParams();
  body.set('To', String((existing as any)?.phone_e164 || ''));
  body.set('Code', String(code || '').trim());

  const res = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const payload: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(payload?.message || 'Unable to verify code.'));
  }

  const approved = String(payload?.status || '').toLowerCase() === 'approved';
  const { data, error } = await supabaseAdmin
    .from('insurance_phone_verifications')
    .update({
      status: approved ? 'verified' : 'failed',
      verified_at: approved ? new Date().toISOString() : null,
      metadata: {
        ...((existing as any)?.metadata || {}),
        check_sid: String(payload?.sid || ''),
        twilio_status: String(payload?.status || ''),
      },
    })
    .eq('id', verificationId)
    .select('*')
    .single();
  if (error) throw error;

  return data;
}
