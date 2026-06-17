import type { Handler } from '@netlify/functions';
import { assertPost, json, parseJson } from './_lib/http';
import { checkInsurancePhoneVerification } from './_lib/insurancePhoneVerification';

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const body = parseJson<any>(event.body);
    const verificationId = String(body?.verification_id || '').trim();
    const code = String(body?.code || '').trim();
    if (!verificationId || !code) return json(400, { ok: false, error: 'verification_id and code are required.' });
    const verification = await checkInsurancePhoneVerification(verificationId, code);
    return json(200, {
      ok: true,
      verification_id: String((verification as any)?.id || ''),
      status: String((verification as any)?.status || ''),
      verified_at: (verification as any)?.verified_at || null,
      phone_normalized: String((verification as any)?.phone_normalized || ''),
    });
  } catch (error: any) {
    return json(Number(error?.statusCode) || 500, { ok: false, error: error?.message || 'Unexpected error' });
  }
};

export default handler;
