import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function requireEnv(name: string, fallbacks: string[] = []): string {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  throw new Error(`Missing ${name}${fallbacks.length ? ` (or ${fallbacks.join(', ')})` : ''}`);
}

function stripe(): Stripe {
  const key = requireEnv('STRIPE_SECRET_KEY');
  return new Stripe(key, { apiVersion: '2023-10-16' });
}

const looksLikeUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const isDuplicateError = (error: any) => {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === '23505' || /duplicate key/i.test(message);
};

const isMissingTableError = (error: any) => {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === '42P01' || /does not exist/i.test(message);
};

const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const signature = (event.headers['stripe-signature'] ||
      (event.headers as any)['Stripe-Signature'] ||
      (event.headers as any)['STRIPE-SIGNATURE']) as string | undefined;

    const webhookSecret = requireEnv('STRIPE_WEBHOOK_SECRET');
    if (!signature) return json(400, { error: 'Missing stripe-signature' });
    if (!event.body) return json(400, { error: 'Missing body' });

    const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body);
    const stripeClient = stripe();
    const stripeEvent = stripeClient.webhooks.constructEvent(rawBody, signature, webhookSecret);

    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const meta = (session.metadata || {}) as Record<string, string>;
      const checkoutIntentId = String(meta.checkout_intent_id || '').trim();
      if (!checkoutIntentId) return json(400, { error: 'Missing metadata.checkout_intent_id' });

      const buyerId = looksLikeUuid(String(meta.buyer_id || '').trim()) ? String(meta.buyer_id).trim() : null;

      const { data: checkoutIntent, error: intentError } = await supabaseAdmin
        .from('checkout_intents')
        .select('*')
        .eq('id', checkoutIntentId)
        .single();

      if (intentError || !checkoutIntent) {
        return json(404, { error: 'checkout_intent not found' });
      }

      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
      const sessionId = String(session.id);

      await supabaseAdmin
        .from('checkout_intents')
        .update({
          status: 'completed',
          stripe_session_id: sessionId,
          stripe_payment_intent_id: paymentIntentId,
        })
        .eq('id', checkoutIntentId);

      const split = (checkoutIntent as any).split_json || {};

      const cartLineItems = (split?.cart?.line_items || []) as Array<{
        product_id: string;
        variant_id?: string | null;
        qty: number;
        unit_price: number;
        name?: string;
      }>;

      const itemsSubtotal = Number(checkoutIntent.items_subtotal || 0);
      const shippingAmount = Number(checkoutIntent.shipping_amount || 0);
      const taxAmount = Number(checkoutIntent.tax_amount || 0);

      const safeNum = (v: unknown) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };
      const centsToAmount = (v: unknown) => safeNum(v) / 100;

      const affiliateFeeAmount = centsToAmount((checkoutIntent as any).affiliate_fee_cents);
      const beezioFeeAmount = centsToAmount((checkoutIntent as any).beezio_fee_cents);
      const refFeeAmount = centsToAmount((checkoutIntent as any).ref_or_fundraiser_fee_cents);
      const processingFeeAmount = centsToAmount((checkoutIntent as any).processing_fee_cents);

      const totalAmount = itemsSubtotal + shippingAmount + taxAmount + affiliateFeeAmount + beezioFeeAmount + refFeeAmount + processingFeeAmount;

      const billingEmail =
        session.customer_details?.email ||
        (typeof session.customer_email === 'string' ? session.customer_email : null) ||
        null;

      const billingName =
        (typeof session.customer_details?.name === 'string' ? session.customer_details?.name : null) || null;

      const address = session.customer_details?.address || null;

      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          seller_id: checkoutIntent.seller_id,
          buyer_id: buyerId,
          checkout_intent_id: checkoutIntentId,
          items_subtotal: itemsSubtotal,
          shipping_amount: shippingAmount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          affiliate_fee_amount: affiliateFeeAmount || 0,
          beezio_fee_amount: beezioFeeAmount || 0,
          ref_or_fundraiser_fee_amount: refFeeAmount || 0,
          processing_fee_amount: processingFeeAmount || 0,
          currency: checkoutIntent.currency,
          stripe_session_id: sessionId,
          stripe_payment_intent_id: paymentIntentId,
          // A completed Checkout Session indicates the buyer finished the checkout flow.
          // Canonical "money logic" (distribution + fulfillment trigger) happens on `payment_intent.succeeded`.
          status: 'processing',
          payment_status: 'pending',
          user_id: buyerId,
          billing_email: billingEmail,
          billing_name: billingName,
          billing_address: address?.line1 || null,
          billing_city: address?.city || null,
          billing_state: address?.state || null,
          billing_zip: address?.postal_code || null,
          order_items: cartLineItems,
        })
        .select('id')
        .single();

      if (orderError) {
        if (!isDuplicateError(orderError)) {
          return json(500, { error: orderError.message || 'Failed to create order' });
        }
      }

      const orderId = (order as any)?.id || null;

      if (orderId && Array.isArray(cartLineItems) && cartLineItems.length) {
        const orderItemsRows = cartLineItems.map((li) => ({
          order_id: orderId,
          product_id: li.product_id,
          seller_id: checkoutIntent.seller_id,
          affiliate_id: checkoutIntent.affiliate_id || null,
          quantity: Math.max(1, Math.floor(Number(li.qty || 0))),
          unit_price: Number(li.unit_price || 0),
          total_price: Number(li.unit_price || 0) * Math.max(1, Math.floor(Number(li.qty || 0))),
          price: Number(li.unit_price || 0),
          variant_id: li.variant_id || null,
        }));

        const { error: orderItemsError } = await supabaseAdmin.from('order_items').insert(orderItemsRows);
        if (orderItemsError) {
          if (!isDuplicateError(orderItemsError)) {
            return json(500, { error: orderItemsError.message || 'Failed to create order items' });
          }
        }
      }
    }

    if (stripeEvent.type === 'payment_intent.succeeded' || stripeEvent.type === 'payment_intent.payment_failed') {
      const intent = stripeEvent.data.object as Stripe.PaymentIntent;
      const paymentIntentId = String(intent.id || '').trim();
      if (!paymentIntentId) return json(200, { received: true });

      const isPaid = stripeEvent.type === 'payment_intent.succeeded';
      const newPaymentStatus = isPaid ? 'paid' : 'failed';
      const newStatus = isPaid ? 'completed' : 'failed';

      const tryUpdateOrder = async (payload: Record<string, any>) => {
        const { error } = await supabaseAdmin.from('orders').update(payload).eq('stripe_payment_intent_id', paymentIntentId);
        if (error) throw error;
      };

      try {
        await tryUpdateOrder({ payment_status: newPaymentStatus, status: newStatus, updated_at: new Date().toISOString() });
      } catch {
        try {
          await tryUpdateOrder({ payment_status: newPaymentStatus, status: newStatus });
        } catch {
          try {
            await tryUpdateOrder({ payment_status: newPaymentStatus });
          } catch {
            // If schema differs, don't hard-fail the webhook.
          }
        }
      }

      if (isPaid) {
        const { data: checkoutIntent } = await supabaseAdmin
          .from('checkout_intents')
          .select('id, seller_id, affiliate_id, referrer_id, currency, split_json')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (checkoutIntent?.id) {
          await supabaseAdmin.from('checkout_intents').update({ status: 'completed' }).eq('id', checkoutIntent.id);

          const { data: orderRow } = await supabaseAdmin
            .from('orders')
            .select('id')
            .eq('checkout_intent_id', checkoutIntent.id)
            .maybeSingle();

          const breakdown = (checkoutIntent as any)?.split_json?.breakdown_cents || {};
          const centsToAmount = (v: unknown) => {
            const n = Number(v);
            return Number.isFinite(n) ? n / 100 : 0;
          };

          const rows: any[] = [];
          if ((checkoutIntent as any)?.affiliate_id && centsToAmount((breakdown as any).affiliate_fee_cents) > 0) {
            rows.push({
              type: 'affiliate',
              seller_id: (checkoutIntent as any).seller_id,
              affiliate_id: (checkoutIntent as any).affiliate_id,
              order_id: orderRow?.id ?? null,
              checkout_intent_id: (checkoutIntent as any).id,
              amount: centsToAmount((breakdown as any).affiliate_fee_cents),
              currency: (checkoutIntent as any).currency || 'USD',
              status: 'paid',
            });
          }
          if ((checkoutIntent as any)?.referrer_id && centsToAmount((breakdown as any).ref_or_fundraiser_fee_cents) > 0) {
            rows.push({
              type: 'referrer',
              seller_id: (checkoutIntent as any).seller_id,
              referrer_id: (checkoutIntent as any).referrer_id,
              order_id: orderRow?.id ?? null,
              checkout_intent_id: (checkoutIntent as any).id,
              amount: centsToAmount((breakdown as any).ref_or_fundraiser_fee_cents),
              currency: (checkoutIntent as any).currency || 'USD',
              status: 'paid',
            });
          }
          if (centsToAmount((breakdown as any).tax_cents) > 0) {
            rows.push({
              type: 'tax',
              seller_id: (checkoutIntent as any).seller_id,
              order_id: orderRow?.id ?? null,
              checkout_intent_id: (checkoutIntent as any).id,
              amount: centsToAmount((breakdown as any).tax_cents),
              currency: (checkoutIntent as any).currency || 'USD',
              status: 'paid',
            });
          }

          if (rows.length) {
            const { error: ledgerError } = await supabaseAdmin.from('earnings_ledger').insert(rows);
            if (ledgerError && !isDuplicateError(ledgerError) && !isMissingTableError(ledgerError)) {
              return json(500, { error: ledgerError.message || 'Failed to write earnings ledger' });
            }
          }
        }
      }
    }

    return json(200, { received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json(400, { error: message });
  }
};

export { handler };
