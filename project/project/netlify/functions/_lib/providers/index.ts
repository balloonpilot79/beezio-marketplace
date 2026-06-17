import { PaymentProvider, PaymentProviderName } from './PaymentProvider';
import { PayPalProvider } from './PayPalProvider';

export function getPaymentProvider(name: PaymentProviderName): PaymentProvider {
  if (name !== 'paypal') {
    throw new Error(`Unsupported payment provider: ${String(name)}`);
  }
  return new PayPalProvider();
}
