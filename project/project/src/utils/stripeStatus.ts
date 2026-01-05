export type StripeMode = 'disabled' | 'test' | 'live';

export type StripeStatus = {
  mode: StripeMode;
  publishableKeyPresent: boolean;
  publishableKeyPrefix: 'pk_live' | 'pk_test' | 'unknown' | 'missing';
};

export function getStripeStatus(): StripeStatus {
  const key = String(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '').trim();

  if (!key) {
    return {
      mode: 'disabled',
      publishableKeyPresent: false,
      publishableKeyPrefix: 'missing',
    };
  }

  if (key.startsWith('pk_live_')) {
    return { mode: 'live', publishableKeyPresent: true, publishableKeyPrefix: 'pk_live' };
  }

  if (key.startsWith('pk_test_')) {
    return { mode: 'test', publishableKeyPresent: true, publishableKeyPrefix: 'pk_test' };
  }

  return { mode: 'test', publishableKeyPresent: true, publishableKeyPrefix: 'unknown' };
}
