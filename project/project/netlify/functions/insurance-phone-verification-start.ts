import type { Handler } from '@netlify/functions';
import { assertPost, json, parseJson } from './_lib/http';
import { startInsurancePhoneVerification } from './_lib/insurancePhoneVerification';

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const body = parseJson<any>(event.body);
    const phone = String(body?.phone || '').trim();
    if (!phone) return json(400, { ok: false, error: 'Phone is required.' });
    const verification = await startInsurancePhoneVerification(phone);
    return json(200, {
      ok: true,
      verification_id: String((verification as any)?.id || ''),
      status: String((verification as any)?.status || 'pending'),
    });
  } catch (error: any) {
    return json(Number(error?.statusCode) || 500, { ok: false, error: error?.message || 'Unexpected error' });
  }
};

export default handler;
