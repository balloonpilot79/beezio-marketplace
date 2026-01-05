import Stripe from 'stripe';
import { centsToStripeAmount } from './money';

export type CheckoutLineItem = {
  name: string;
  quantity: number;
  unit_amount_cents: number;
  product_metadata?: Record<string, string>;
};

export type BuildCheckoutSessionInput = {
  currency: string;
  line_items: CheckoutLineItem[];
  success_url: string;
  cancel_url: string;
  metadata: Record<string, string>;
};

function normalizeCurrency(input: string): string {
  const c = String(input || '').trim().toLowerCase();
  return c || 'usd';
}

function stripe(): Stripe {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY');
  return new Stripe(key, { apiVersion: '2023-10-16' });
}

export async function buildCheckoutSession(input: BuildCheckoutSessionInput): Promise<Stripe.Checkout.Session> {
  const currency = normalizeCurrency(input.currency);
  if (!input.line_items?.length) throw new Error('Missing line_items');

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = input.line_items.map((li) => {
    const qty = Math.max(1, Math.floor(Number(li.quantity || 0)));
    const unitAmountCents = Math.max(0, Math.floor(Number(li.unit_amount_cents || 0)));
    return {
      quantity: qty,
      price_data: {
        currency,
        unit_amount: centsToStripeAmount(unitAmountCents),
        product_data: {
          name: li.name,
          ...(li.product_metadata ? { metadata: li.product_metadata } : null),
        },
      },
    };
  });

  const stripeClient = stripe();
  return stripeClient.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    success_url: input.success_url,
    cancel_url: input.cancel_url,
    metadata: input.metadata,
    payment_intent_data: { metadata: input.metadata },
  });
}

