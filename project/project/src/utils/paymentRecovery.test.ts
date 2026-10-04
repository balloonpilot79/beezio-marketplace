import { describe, expect, it } from 'vitest';
import { paymentRecoveryMessage, safePayPalApprovalUrl } from './paymentRecovery';
describe('payment recovery', () => {
  it('explains approval and decline without claiming payment completed', () => {
    expect(paymentRecoveryMessage({ code: 'PAYER_ACTION_REQUIRED' }, 409)).toContain('needs your approval');
    expect(paymentRecoveryMessage({ code: 'INSTRUMENT_DECLINED' }, 422)).toContain('declined');
  });
  it('reports a support reference without exposing server details', () => {
    const result = paymentRecoveryMessage({ error: 'private database detail' }, 500);
    expect(result).toContain('HTTP_500');
    expect(result).not.toContain('private database detail');
  });
  it('only accepts secure PayPal approval destinations', () => {
    expect(safePayPalApprovalUrl('https://www.paypal.com/checkoutnow?token=existing')).toBeTruthy();
    expect(safePayPalApprovalUrl('https://paypal.com.example.org/')).toBeNull();
    expect(safePayPalApprovalUrl('javascript:alert(1)')).toBeNull();
  });
});
