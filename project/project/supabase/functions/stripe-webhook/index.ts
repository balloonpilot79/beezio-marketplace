// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PaymentMetadata {
  productId: string
  sellerId: string
  userId: string
  commissionRate: string
  affiliateId?: string
  affiliateCommissionRate?: string
  billingName: string
  billingEmail: string
  taxAmount?: string
  shippingAmount?: string
  allItems?: string
}

// Unified distribution constants (keep aligned with frontend)
const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED = 0.30;
const PLATFORM_PERCENT = 0.15;
// Referral override is 5 percentage points of the sale base (seller ask),
// paid out of Beezio's 15% platform fee (so Beezio nets 10% + any surcharge).
const REFERRER_PERCENT_OF_SALE_BASE = 0.05;
const PLATFORM_FEE_UNDER_20_THRESHOLD = 20;
const PLATFORM_FEE_UNDER_20_SURCHARGE = 1;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const platformSurchargePerUnit = (sellerAskPerUnit: number): number =>
  Number.isFinite(sellerAskPerUnit) && sellerAskPerUnit > 0 && sellerAskPerUnit <= PLATFORM_FEE_UNDER_20_THRESHOLD
    ? PLATFORM_FEE_UNDER_20_SURCHARGE
    : 0;

type MetaCartItem = {
  productId: string;
  title?: string;
  price: number; // unit final customer price
  quantity: number;
  sellerId: string;
  sellerDesiredAmount?: number; // unit seller ask
  affiliateId?: string | null; // may be profile id or referral code
  affiliateCommissionRate?: number; // percent
  affiliateAmount?: number; // unit affiliate payout (authoritative when present)
  platformFee?: number; // unit Beezio fee (authoritative when present)
  stripeFee?: number; // unit Stripe fee estimate (authoritative when present)
  variantId?: string | null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
      Deno.env.get('SERVICE_ROLE_KEY') ??
      ''

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    )

    const tableHasColumn = async (tableName: string, columnName: string): Promise<boolean> => {
      try {
        const { data, error } = await supabase
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_name', tableName)
          .eq('column_name', columnName)
          .limit(1)
          .maybeSingle()
        if (error) return false
        return Boolean(data)
      } catch (_e) {
        return false
      }
    }

    const signature = req.headers.get('stripe-signature')
    const body = await req.text()
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (!signature || !webhookSecret) {
      throw new Error('Missing signature or webhook secret')
    }

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    console.log('Webhook event received:', event.type)

    // Global idempotency: if we've already processed this Stripe event id, return 200 immediately.
    try {
      const obj: any = event.data?.object as any
      const paymentIntentId =
        event.type.startsWith('payment_intent.')
          ? String(obj?.id || '')
          : event.type.startsWith('refund.')
            ? typeof obj?.payment_intent === 'string'
              ? String(obj.payment_intent)
              : null
            : null
      const checkoutIntentId =
        event.type.startsWith('payment_intent.')
          ? String(obj?.metadata?.checkout_intent_id || '').trim() || null
          : null

      const { error: insertEventError } = await supabase.from('stripe_events').insert({
        stripe_event_id: event.id,
        type: event.type,
        status: 'processed',
        checkout_intent_id: checkoutIntentId,
        payment_intent_id: paymentIntentId,
        raw: event as any,
        processed_at: new Date().toISOString(),
      } as any)

      const msg = String((insertEventError as any)?.message || '')
      const code = String((insertEventError as any)?.code || '')
      const isDuplicate = code === '23505' || /duplicate key/i.test(msg)
      if (insertEventError && isDuplicate) {
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
    } catch (_e) {
      // Non-fatal: if stripe_events table isn't present yet, continue without global idempotency.
    }

    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account

        const connectReady =
          Boolean(account.charges_enabled) &&
          Boolean(account.payouts_enabled) &&
          Boolean(account.details_submitted) &&
          (account.requirements?.currently_due?.length || 0) === 0 &&
          (account.requirements?.past_due?.length || 0) === 0

        const { data: profileRow } = await supabase
          .from('profiles')
          .select('id, seller_verification_status, identity_verification_status')
          .eq('stripe_account_id', account.id)
          .maybeSingle()

        if (!profileRow?.id) {
          console.warn('account.updated: no profile found for stripe_account_id', account.id)
          break
        }

        const identityStatus = String((profileRow as any)?.identity_verification_status || 'not_started')
        const identityVerified = identityStatus === 'verified'

        const nextSellerStatus = connectReady
          ? identityVerified
            ? 'verified'
            : 'pending_identity'
          : 'pending_stripe'

        await supabase
          .from('profiles')
          .update({
            stripe_charges_enabled: account.charges_enabled || false,
            stripe_payouts_enabled: account.payouts_enabled || false,
            stripe_details_submitted: account.details_submitted || false,
            stripe_requirements_currently_due: account.requirements?.currently_due || [],
            stripe_requirements_past_due: account.requirements?.past_due || [],
            seller_verification_status: nextSellerStatus,
            verification_updated_at: new Date().toISOString(),
          })
          .eq('id', profileRow.id)

        try {
          await supabase.from('seller_verification_events').insert({
            seller_id: profileRow.id,
            event_type: 'connect.account_updated',
            details: {
              stripe_account_id: account.id,
              charges_enabled: account.charges_enabled,
              payouts_enabled: account.payouts_enabled,
              details_submitted: account.details_submitted,
              currently_due: account.requirements?.currently_due || [],
              past_due: account.requirements?.past_due || [],
              computed_connect_ready: connectReady,
              computed_next_status: nextSellerStatus,
            },
          })
        } catch (_e) {
          // Non-fatal: the audit table may not exist yet, or insert could be blocked by schema mismatch.
        }

        break
      }

      case 'identity.verification_session.verified':
      case 'identity.verification_session.requires_input':
      case 'identity.verification_session.processing':
      case 'identity.verification_session.canceled': {
        const session = event.data.object as Stripe.Identity.VerificationSession

        const status = String((session as any)?.status || '').toLowerCase()
        const mappedStatus =
          status === 'verified'
            ? 'verified'
            : status === 'requires_input'
              ? 'requires_input'
              : status === 'canceled'
                ? 'canceled'
                : 'processing'

        // Try to resolve seller by explicit session id first; fall back to metadata.
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('id, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted, stripe_requirements_currently_due, stripe_requirements_past_due')
          .or(
            [
              session.id ? `stripe_identity_verification_session_id.eq.${session.id}` : null,
              (session.metadata as any)?.beezio_profile_id ? `id.eq.${(session.metadata as any).beezio_profile_id}` : null,
            ]
              .filter(Boolean)
              .join(',')
          )
          .maybeSingle()

        if (!profileRow?.id) {
          console.warn('identity.*: no profile found for verification session', session.id)
          break
        }

        const connectReadyFromDb =
          Boolean((profileRow as any)?.stripe_charges_enabled) &&
          Boolean((profileRow as any)?.stripe_payouts_enabled) &&
          Boolean((profileRow as any)?.stripe_details_submitted) &&
          Array.isArray((profileRow as any)?.stripe_requirements_currently_due) &&
          ((profileRow as any).stripe_requirements_currently_due.length || 0) === 0 &&
          Array.isArray((profileRow as any)?.stripe_requirements_past_due) &&
          ((profileRow as any).stripe_requirements_past_due.length || 0) === 0

        const nextSellerStatus = connectReadyFromDb
          ? mappedStatus === 'verified'
            ? 'verified'
            : 'pending_identity'
          : 'pending_stripe'

        await supabase
          .from('profiles')
          .update({
            identity_verification_status: mappedStatus,
            stripe_identity_verification_session_id: session.id,
            seller_verification_status: nextSellerStatus,
            verification_updated_at: new Date().toISOString(),
          })
          .eq('id', profileRow.id)

        try {
          await supabase.from('seller_verification_events').insert({
            seller_id: profileRow.id,
            event_type: 'identity.session_updated',
            details: {
              session_id: session.id,
              status: session.status,
              computed_next_status: nextSellerStatus,
            },
          })
        } catch (_e) {
          // Non-fatal: audit logging should not break webhooks.
        }

        break
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent

        // Stripe Bible v1 path (Separate Charges + Transfers + deterministic checkout_intents replay)
        try {
          const expanded = await stripe.paymentIntents.retrieve(paymentIntent.id, { expand: ['charges.data'] })
          const splitVersion = String(((expanded.metadata as any)?.split_version || (paymentIntent.metadata as any)?.split_version || '')).trim()
          const checkoutIntentId = String(((expanded.metadata as any)?.checkout_intent_id || '')).trim()

          if (splitVersion === 'BEEZIO_SPLIT_V1' && checkoutIntentId) {
            console.log('Stripe Bible v1 payment_intent.succeeded:', paymentIntent.id)

            // Idempotency check: if we've already processed this payment intent, skip
            const { data: existingTx } = await supabase
              .from('transactions')
              .select('id')
              .eq('stripe_payment_intent_id', paymentIntent.id)
              .limit(1)
              .maybeSingle()

            if (existingTx) {
              return new Response(JSON.stringify({ received: true, skipped: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
              })
            }

            const chargeId = (expanded.charges?.data?.[0] as any)?.id ? String((expanded.charges?.data?.[0] as any).id) : null
            if (!chargeId) throw new Error('payment_intent.succeeded: missing charge id on PaymentIntent')

            const { data: checkoutIntent } = await supabase
              .from('checkout_intents')
              .select(
                [
                  'id',
                  'seller_id',
                  'affiliate_id',
                  'referrer_id',
                  'fundraiser_id',
                  'currency',
                  'product_subtotal_cents',
                  'affiliate_fee_cents',
                  'beezio_fee_cents',
                  'ref_or_fundraiser_fee_cents',
                  'processing_fee_cents',
                  'seller_transfer_cents',
                  'total_cents',
                ].join(',')
              )
              .eq('id', checkoutIntentId)
              .maybeSingle()

            if (!checkoutIntent?.id) throw new Error('payment_intent.succeeded: checkout_intent not found')

            const cents = (v: unknown) => {
              const n = Number(v)
              return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
            }
            const centsToAmount = (c: number) => Math.round((c / 100 + Number.EPSILON) * 100) / 100

            const sellerTransferCents = cents((checkoutIntent as any).seller_transfer_cents ?? (checkoutIntent as any).product_subtotal_cents)
            const affiliateFeeCents = cents((checkoutIntent as any).affiliate_fee_cents)
            const refFeeCents = cents((checkoutIntent as any).ref_or_fundraiser_fee_cents)
            const beezioFeeCents = cents((checkoutIntent as any).beezio_fee_cents)
            const processingFeeCents = cents((checkoutIntent as any).processing_fee_cents)
            const totalCents = cents((checkoutIntent as any).total_cents) || cents(expanded.amount_received ?? expanded.amount)

            const currency = String((checkoutIntent as any).currency || expanded.currency || 'USD').toUpperCase()
            const currencyLower = currency.toLowerCase()

            // Create transaction record
            const { data: transaction, error: transactionError } = await supabase
              .from('transactions')
              .insert({
                stripe_payment_intent_id: paymentIntent.id,
                stripe_charge_id: chargeId,
                amount_total_cents: totalCents,
                total_amount: centsToAmount(totalCents),
                currency,
                status: 'completed',
              })
              .select()
              .single()

            if (transactionError) throw transactionError

            // Resolve order (may already exist from checkout.session.completed handler)
            let beezioOrderId: string | null = null
            try {
              const { data: orderRow } = await supabase
                .from('orders')
                .select('id')
                .eq('checkout_intent_id', checkoutIntentId)
                .maybeSingle()
              beezioOrderId = (orderRow as any)?.id ?? null
            } catch {
              // ignore
            }
            if (!beezioOrderId) {
              try {
                const { data: orderRow } = await supabase
                  .from('orders')
                  .select('id')
                  .eq('stripe_payment_intent_id', paymentIntent.id)
                  .maybeSingle()
                beezioOrderId = (orderRow as any)?.id ?? null
              } catch {
                // ignore
              }
            }

            // Fetch Stripe account ids for destinations
            const destinationIds = [
              String((checkoutIntent as any).seller_id || '').trim(),
              String((checkoutIntent as any).affiliate_id || '').trim(),
              String((checkoutIntent as any).referrer_id || '').trim(),
              String((checkoutIntent as any).fundraiser_id || '').trim(),
            ].filter(Boolean)

            const stripeAccountByProfileId = new Map<string, string>()
            if (destinationIds.length) {
              const { data: profiles } = await supabase
                .from('profiles')
                .select('id, stripe_account_id')
                .in('id', destinationIds)
              for (const row of (profiles as any[]) || []) {
                const id = row?.id ? String(row.id) : null
                const acct = row?.stripe_account_id ? String(row.stripe_account_id) : null
                if (id && acct) stripeAccountByProfileId.set(id, acct)
              }
            }

            // IMPORTANT: No direct Stripe transfers in this webhook.
            // We record payout eligibility in the DB (orders/payment_distributions/user_earnings),
            // and process actual transfers on a bi-monthly payout run.

            // Create payment_distributions rows so sellers/affiliates/fundraisers all flow through the same payout schedule.
            // Fundraisers and referrers are paid on the affiliate rail.
            try {
              const paymentDistributionsHasAvailableAt = await tableHasColumn('payment_distributions', 'available_at')
              const paymentDistributionsHasOrderId = await tableHasColumn('payment_distributions', 'order_id')
              const paymentDistributionsHasTransactionId = await tableHasColumn('payment_distributions', 'transaction_id')

              const makeRow = (row: any) => {
                const out: any = { ...row }
                if (!paymentDistributionsHasTransactionId) delete out.transaction_id
                if (paymentDistributionsHasOrderId && beezioOrderId) out.order_id = beezioOrderId
                return out
              }

              const rows: any[] = []

              const sellerProfileId = String((checkoutIntent as any).seller_id || '').trim()
              if (sellerProfileId && sellerTransferCents > 0) {
                const sellerRow: any = {
                  transaction_id: (transaction as any)?.id ?? null,
                  recipient_type: 'seller',
                  recipient_id: sellerProfileId,
                  amount: centsToAmount(sellerTransferCents),
                  percentage: 0,
                  status: 'held',
                }
                if (paymentDistributionsHasAvailableAt) {
                  sellerRow.available_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
                  sellerRow.hold_reason = 'payout_delay_14d_and_shipped'
                }
                rows.push(makeRow(sellerRow))
              }

              const affiliateBeneficiaryId = String((checkoutIntent as any).affiliate_id || (checkoutIntent as any).fundraiser_id || '').trim()
              if (affiliateBeneficiaryId && affiliateFeeCents > 0) {
                rows.push(makeRow({
                  transaction_id: (transaction as any)?.id ?? null,
                  recipient_type: 'affiliate',
                  recipient_id: affiliateBeneficiaryId,
                  amount: centsToAmount(affiliateFeeCents),
                  percentage: 0,
                  status: 'pending',
                }))
              }

              const refOrFundraiserBeneficiaryId = String((checkoutIntent as any).fundraiser_id || (checkoutIntent as any).referrer_id || '').trim()
              if (refOrFundraiserBeneficiaryId && refFeeCents > 0) {
                rows.push(makeRow({
                  transaction_id: (transaction as any)?.id ?? null,
                  recipient_type: 'affiliate',
                  recipient_id: refOrFundraiserBeneficiaryId,
                  amount: centsToAmount(refFeeCents),
                  percentage: 0,
                  status: 'pending',
                }))
              }

              const platformNetCents = Math.max(0, beezioFeeCents - refFeeCents)
              if (platformNetCents > 0) {
                rows.push(makeRow({
                  transaction_id: (transaction as any)?.id ?? null,
                  recipient_type: 'platform',
                  recipient_id: null,
                  amount: centsToAmount(platformNetCents),
                  percentage: 0,
                  status: 'completed',
                }))
              }

              const insertable = rows.filter((r) => {
                if (paymentDistributionsHasOrderId && !beezioOrderId) return false
                if (paymentDistributionsHasTransactionId && !r.transaction_id) return false
                return true
              })

              if (insertable.length) {
                await supabase.from('payment_distributions').insert(insertable as any)
              }

            } catch (_e) {
              // Non-fatal: ledger should not block checkout completion webhooks.
            }

            // Best-effort: update order status + persist breakdown for audit
            if (beezioOrderId) {
              await supabase
                .from('orders')
                .update({
                  status: 'completed',
                  payment_status: 'paid',
                  stripe_charge_id: chargeId,
                  affiliate_fee_amount: centsToAmount(affiliateFeeCents),
                  beezio_fee_amount: centsToAmount(beezioFeeCents),
                  ref_or_fundraiser_fee_amount: centsToAmount(refFeeCents),
                  processing_fee_amount: centsToAmount(processingFeeCents),
                  total_amount: centsToAmount(totalCents),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', beezioOrderId)
            } else {
              await supabase
                .from('orders')
                .update({
                  status: 'completed',
                  payment_status: 'paid',
                  stripe_charge_id: chargeId,
                  affiliate_fee_amount: centsToAmount(affiliateFeeCents),
                  beezio_fee_amount: centsToAmount(beezioFeeCents),
                  ref_or_fundraiser_fee_amount: centsToAmount(refFeeCents),
                  processing_fee_amount: centsToAmount(processingFeeCents),
                  total_amount: centsToAmount(totalCents),
                  updated_at: new Date().toISOString(),
                })
                .eq('stripe_payment_intent_id', paymentIntent.id)
            }

            // Record platform revenue (beezio fee); processing fee is intended to offset Stripe processing cost.
            try {
              const currentMonth = new Date().toISOString().slice(0, 7)
              await supabase.from('platform_revenue').insert({
                transaction_id: (transaction as any)?.id ?? null,
                amount: centsToAmount(beezioFeeCents),
                revenue_type: 'beezio_fee',
                month_year: currentMonth,
              } as any)
            } catch {
              // non-fatal
            }

            return new Response(JSON.stringify({ received: true, split_version: 'BEEZIO_SPLIT_V1' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            })
          }
        } catch (e) {
          console.error('Stripe Bible v1 handler error:', e)
          // Fall through to legacy handler below.
        }
        
        // Extract metadata
        const metadata = paymentIntent.metadata as PaymentMetadata
        const {
          productId,
          sellerId,
          userId,
          commissionRate,
          affiliateId,
          affiliateCommissionRate,
          billingName,
          billingEmail,
          allItems,
        } = metadata

        console.log('Processing payment distribution for:', paymentIntent.id)

        // Idempotency check: if we've already processed this payment intent, skip
        const { data: existingTx, error: existingError } = await supabase
          .from('transactions')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .limit(1)
          .maybeSingle()

        if (existingError) {
          console.error('Error checking existing transaction for idempotency:', existingError)
          // continue - we'll attempt to create the transaction below, but surface the error to logs
        }

        if (existingTx) {
          console.log(`PaymentIntent ${paymentIntent.id} already processed (transaction id: ${existingTx.id}). Skipping.`)
          return new Response(JSON.stringify({ received: true, skipped: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          })
        }

        // Create transaction record
        const { data: transaction, error: transactionError } = await supabase
          .from('transactions')
          .insert({
            stripe_payment_intent_id: paymentIntent.id,
            total_amount: paymentIntent.amount / 100, // Convert from cents
            currency: paymentIntent.currency.toUpperCase(),
            status: 'completed'
          })
          .select()
          .single()

        if (transactionError) {
          console.error('Error creating transaction:', transactionError)
          throw transactionError
        }

        // Best-effort: resolve the Beezio order id so downstream records can link correctly
        let beezioOrderId: string | null = null
        try {
          const { data: orderRow } = await supabase
            .from('orders')
            .select('id')
            .eq('stripe_payment_intent_id', paymentIntent.id)
            .maybeSingle()
          beezioOrderId = (orderRow as any)?.id ?? null
        } catch (e) {
          // non-blocking
        }

        // Calculate distributions using metadata.allItems when available (authoritative).
        const totalAmount = round2(paymentIntent.amount / 100)
        let taxAmount = round2(parseFloat((metadata as any)?.taxAmount || '0') || 0)
        let shippingAmount = round2(parseFloat((metadata as any)?.shippingAmount || '0') || 0)

        let items: MetaCartItem[] = [];
        try {
          if (allItems) {
            const parsed = JSON.parse(allItems);
            if (Array.isArray(parsed)) {
              items = parsed as MetaCartItem[];
            }
          }
        } catch (e) {
          console.warn('Failed to parse metadata.allItems; falling back to legacy metadata fields');
        }

        const looksLikeUuid = (value: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

        // If the PaymentIntent came from Stripe Checkout Session flow, metadata will typically include
        // `checkout_intent_id` instead of full cart JSON (Stripe metadata size limits).
        const checkoutIntentId = String((metadata as any)?.checkout_intent_id || '').trim();
        if (!items.length && checkoutIntentId && looksLikeUuid(checkoutIntentId)) {
          try {
            const { data: checkoutIntentRow } = await supabase
              .from('checkout_intents')
              .select('id, seller_id, affiliate_id, referrer_id, fundraiser_id, items_subtotal, shipping_amount, tax_amount, split_json')
              .eq('id', checkoutIntentId)
              .maybeSingle();

            if (checkoutIntentRow?.id) {
              // Prefer the order linked by checkout_intent_id if present.
              if (!beezioOrderId) {
                try {
                  const { data: orderByIntent } = await supabase
                    .from('orders')
                    .select('id')
                    .eq('checkout_intent_id', checkoutIntentRow.id)
                    .maybeSingle();
                  beezioOrderId = (orderByIntent as any)?.id ?? null;
                } catch {
                  // ignore
                }
              }

              if (!taxAmount && Number.isFinite(Number((checkoutIntentRow as any).tax_amount))) {
                taxAmount = round2(Number((checkoutIntentRow as any).tax_amount));
              }
              if (!shippingAmount && Number.isFinite(Number((checkoutIntentRow as any).shipping_amount))) {
                shippingAmount = round2(Number((checkoutIntentRow as any).shipping_amount));
              }

              const split = (checkoutIntentRow as any).split_json || {};
              const storedItems = Array.isArray(split?.items) ? (split.items as any[]) : [];
              if (storedItems.length) {
                items = storedItems.map((it) => ({
                  productId: String(it.productId || it.product_id || ''),
                  price: Number(it.price || it.unit_price || 0),
                  quantity: Number(it.quantity || it.qty || 1),
                  sellerId: String(it.sellerId || (checkoutIntentRow as any).seller_id || ''),
                  sellerDesiredAmount: Number(it.sellerDesiredAmount || it.seller_ask || 0) || undefined,
                  // Fundraisers are paid on the affiliate rail: treat fundraiser_id as affiliate_id when present.
                  affiliateId: it.affiliateId ?? (checkoutIntentRow as any).affiliate_id ?? (checkoutIntentRow as any).fundraiser_id ?? null,
                  affiliateCommissionRate: Number(it.affiliateCommissionRate || 0) || 0,
                  affiliateAmount: Number(it.affiliateAmount || 0) || undefined,
                  platformFee: Number(it.platformFee || 0) || undefined,
                  variantId: it.variantId ?? it.variant_id ?? null,
                })) as MetaCartItem[];
              } else {
                const cartLineItems = Array.isArray(split?.cart?.line_items) ? (split.cart.line_items as any[]) : [];
                const productIds = Array.from(
                  new Set(cartLineItems.map((li) => String(li?.product_id || li?.productId || '').trim()).filter(Boolean))
                );

                const productsById = new Map<string, any>();
                if (productIds.length) {
                  const { data: products } = await supabase
                    .from('products')
                    .select('id, seller_ask, seller_amount, seller_ask_price, commission_rate, commission_type, flat_commission_amount')
                    .in('id', productIds);
                  for (const row of (products as any[]) || []) productsById.set(String(row.id), row);
                }

                items = cartLineItems
                  .map((li) => {
                    const productId = String(li?.product_id || li?.productId || '').trim();
                    if (!productId) return null;
                    const qty = Number.isFinite(Number(li?.qty)) ? Number(li.qty) : 1;
                    const unitPrice = Number.isFinite(Number(li?.unit_price)) ? Number(li.unit_price) : 0;
                    const product = productsById.get(productId);
                    const sellerAsk =
                      Number(product?.seller_ask || 0) ||
                      Number(product?.seller_amount || 0) ||
                      Number(product?.seller_ask_price || 0) ||
                      0;
                    const commissionType = String(product?.commission_type || 'percentage');
                    const commissionRate = Number(product?.commission_rate || 0);
                    const flatCommission = Number(product?.flat_commission_amount || 0);
                    const affiliateAmountPerUnit =
                      commissionType === 'flat_rate' ? Math.max(0, flatCommission) : Math.max(0, sellerAsk * (Math.max(0, commissionRate) / 100));

                    const platformFeePerUnit =
                      round2(sellerAsk * PLATFORM_PERCENT + platformSurchargePerUnit(sellerAsk));

                    return {
                      productId,
                      price: unitPrice,
                      quantity: qty,
                      sellerId: String((checkoutIntentRow as any).seller_id || ''),
                      sellerDesiredAmount: sellerAsk > 0 ? sellerAsk : undefined,
                      affiliateId: (checkoutIntentRow as any).affiliate_id ?? null,
                      affiliateCommissionRate: commissionType === 'flat_rate' ? 0 : commissionRate,
                      affiliateAmount: affiliateAmountPerUnit,
                      platformFee: platformFeePerUnit,
                      variantId: li?.variant_id || null,
                    } as MetaCartItem;
                  })
                  .filter(Boolean) as MetaCartItem[];
              }
            }
          } catch (e) {
            console.warn('Failed to load checkout_intent cart; falling back to legacy metadata fields', e);
          }
        }

        // Fallback to single-item metadata if needed
        if (!items.length) {
          items = [
            {
              productId,
              price: totalAmount,
              quantity: 1,
              sellerId,
              sellerDesiredAmount: undefined,
              affiliateId: affiliateId || null,
              affiliateCommissionRate: parseFloat(affiliateCommissionRate || '0') || 0,
            },
          ];
        }

        // Estimate COGS for CJ dropship items (for purchasing reserve).
        // Best-effort: if tables/columns are missing, skip without failing the webhook.
        let cjCogsTotal = 0;
        const cjCogsLineItems: any[] = [];
        try {
          const productIds = Array.from(new Set(items.map((it) => String(it?.productId || '').trim()).filter(Boolean)));
          const variantIds = Array.from(new Set(items.map((it) => String(it?.variantId || '').trim()).filter(Boolean)));

          const dropshipByProductId = new Map<string, string>();
          if (productIds.length) {
            const { data: products } = await supabase
              .from('products')
              .select('id, dropship_provider')
              .in('id', productIds);
            for (const row of (products as any[]) || []) {
              dropshipByProductId.set(String(row.id), String(row.dropship_provider || '').toLowerCase());
            }
          }

          const cjVariantByVariantId = new Map<string, string>();
          if (variantIds.length) {
            const { data: variants } = await supabase
              .from('product_variants')
              .select('id, cj_variant_id')
              .in('id', variantIds);
            for (const row of (variants as any[]) || []) {
              if (row?.id && row?.cj_variant_id) {
                cjVariantByVariantId.set(String(row.id), String(row.cj_variant_id));
              }
            }
          }

          const mappingByKey = new Map<string, number>();
          if (productIds.length) {
            const { data: mappings } = await supabase
              .from('cj_product_mappings')
              .select('beezio_product_id, cj_variant_id, cj_cost')
              .in('beezio_product_id', productIds);

            for (const row of (mappings as any[]) || []) {
              const productIdKey = String(row.beezio_product_id || '');
              const cjVarKey = row.cj_variant_id ? String(row.cj_variant_id) : '';
              const cost = parseFloat(String(row.cj_cost ?? '0')) || 0;
              if (productIdKey && cost > 0) {
                mappingByKey.set(`${productIdKey}:${cjVarKey}`, cost);
              }
            }
          }

          for (const item of items) {
            const beezioProductId = String(item?.productId || '').trim();
            if (!beezioProductId) continue;

            const provider = dropshipByProductId.get(beezioProductId) || '';
            if (provider !== 'cj') continue;

            const qty = Number.isFinite(item.quantity) ? Number(item.quantity) : 0;
            if (qty <= 0) continue;

            const cjVariantId = item.variantId ? (cjVariantByVariantId.get(String(item.variantId)) || '') : '';
            const unitCost =
              mappingByKey.get(`${beezioProductId}:${cjVariantId}`) ??
              mappingByKey.get(`${beezioProductId}:`) ??
              0;

            if (!Number.isFinite(unitCost) || unitCost <= 0) continue;

            const lineCost = round2(unitCost * qty);
            cjCogsTotal = round2(cjCogsTotal + lineCost);
            cjCogsLineItems.push({
              productId: beezioProductId,
              variantId: item.variantId || null,
              qty,
              unitCost,
              totalCost: lineCost,
            });
          }
        } catch (e) {
          cjCogsTotal = 0;
          cjCogsLineItems.length = 0;
        }

        const sellerTotals = new Map<string, number>();
        const affiliateTotals = new Map<string, number>();
        let platformGrossTotal = 0;
        let stripeTotal = 0;
        let referralTotal = 0;
        let beezioFeeTotal = 0;

        for (const item of items) {
          const unitFinalPrice = Number.isFinite(item.price) ? item.price : 0;
          const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
          const finalPriceTotal = round2(unitFinalPrice * qty);

          const sellerAskPerUnit = Number.isFinite(item.sellerDesiredAmount)
            ? (item.sellerDesiredAmount as number)
            : unitFinalPrice * 0.7; // best-effort fallback

          const sellerAmount = round2(sellerAskPerUnit * qty);
          const affiliatePercent = Number.isFinite(item.affiliateCommissionRate)
            ? (item.affiliateCommissionRate as number)
            : 0;
          const unitAffiliateAmount = Number.isFinite(item.affiliateAmount)
            ? (item.affiliateAmount as number)
            : round2(sellerAskPerUnit * (Math.max(0, affiliatePercent) / 100));
          const affiliateAmount = round2(unitAffiliateAmount * qty);

          const unitBeezioFee = Number.isFinite(item.platformFee)
            ? (item.platformFee as number)
            : round2(sellerAskPerUnit * PLATFORM_PERCENT + platformSurchargePerUnit(sellerAskPerUnit));
          const beezioFee = round2(unitBeezioFee * qty);
          const platformGross = beezioFee;

          // Recruiter referral:
          // - Referral code is stored at signup: profiles.referred_by_affiliate_id on the *sale owner*.
          // - Sale owner is the attributed affiliate when present; otherwise it's the seller.
          let recruiterId: string | null = null;
          let resolvedAffiliateProfileId: string | null = null;
          let saleOwnerProfileId: string | null = null;

          if (item.affiliateId) {
            const { data: affiliateProfile } = await supabase
              .from('profiles')
              .select('id, referred_by_affiliate_id')
              .or(`id.eq.${item.affiliateId},referral_code.ilike.${item.affiliateId}`)
              .maybeSingle();

            resolvedAffiliateProfileId = (affiliateProfile as any)?.id ?? null;
            saleOwnerProfileId = resolvedAffiliateProfileId;
            recruiterId = (affiliateProfile as any)?.referred_by_affiliate_id ?? null;
          } else {
            const sellerProfileId = item.sellerId || sellerId;
            if (sellerProfileId) {
              const { data: sellerProfile } = await supabase
                .from('profiles')
                .select('id, referred_by_affiliate_id')
                .eq('id', sellerProfileId)
                .maybeSingle();

              saleOwnerProfileId = (sellerProfile as any)?.id ?? null;
              recruiterId = (sellerProfile as any)?.referred_by_affiliate_id ?? null;
            }
          }

          const referralAmount = recruiterId && saleOwnerProfileId
            ? Math.min(platformGross, round2(sellerAmount * REFERRER_PERCENT_OF_SALE_BASE))
            : 0;

          if (recruiterId && saleOwnerProfileId && referralAmount > 0) {
            // Best-effort record (non-blocking)
            try {
              await supabase
                .from('referral_commissions')
                .insert({
                  referrer_id: recruiterId,
                  referred_affiliate_id: saleOwnerProfileId,
                  order_id: beezioOrderId,
                  sale_amount: sellerAmount,
                  commission_amount: referralAmount,
                  commission_rate: 5.0,
                  status: 'pending'
                });
            } catch (e) {
              console.warn('Failed to record referral_commissions (non-blocking):', e);
            }

            // Recruiter overrides are paid on the affiliate rail (bi-monthly), so include them in affiliateTotals.
            affiliateTotals.set(recruiterId, round2((affiliateTotals.get(recruiterId) || 0) + referralAmount));
          }

          // Prefer authoritative per-item Stripe fee estimate when provided by checkout, else compute.
          const unitStripeFee = Number.isFinite(item.stripeFee)
            ? (item.stripeFee as number)
            : round2(unitFinalPrice * STRIPE_PERCENT + STRIPE_FIXED);
          const stripeFee = round2(unitStripeFee * qty);

          const sellerKey = item.sellerId || sellerId;
          sellerTotals.set(sellerKey, round2((sellerTotals.get(sellerKey) || 0) + sellerAmount));

          // Use the resolved affiliate profile id when possible, else raw affiliateId
          const affiliateKey = resolvedAffiliateProfileId || (item.affiliateId ? String(item.affiliateId) : '');
          if (affiliateKey && affiliateAmount > 0) {
            affiliateTotals.set(affiliateKey, round2((affiliateTotals.get(affiliateKey) || 0) + affiliateAmount));
          }

          platformGrossTotal += platformGross;
          stripeTotal += stripeFee;
          referralTotal += referralAmount;
          beezioFeeTotal += beezioFee;
        }

        const sellerTotal = round2(Array.from(sellerTotals.values()).reduce((a, b) => a + b, 0));
        const affiliateTotal = round2(Array.from(affiliateTotals.values()).reduce((a, b) => a + b, 0));
        platformGrossTotal = round2(platformGrossTotal);
        stripeTotal = round2(stripeTotal);
        referralTotal = round2(referralTotal);

        const platformNet = round2(Math.max(platformGrossTotal - referralTotal, 0));

        // Keep transaction totals consistent. Any remainder (shipping/rounding) stays with platform.
        const nonMerchandiseTotal = round2(Math.max(taxAmount, 0) + Math.max(shippingAmount, 0));
        const merchandiseTotal = round2(Math.max(totalAmount - nonMerchandiseTotal, 0));
        const distributedMerchandiseTotal = round2(sellerTotal + affiliateTotal + platformNet + stripeTotal);
        const remainder = round2(Math.max(merchandiseTotal - distributedMerchandiseTotal, 0));
        const platformAmount = round2(platformNet + remainder);

        console.log('✅ Distribution breakdown (unified):', {
          totalAmount,
          sellerTotal,
          affiliateTotal,
          platformGrossTotal,
          referralTotal,
          platformNet,
          stripeTotal,
          remainder
        })

        // Create payment distribution records
        const distributions: any[] = []
        const paymentDistributionsHasAvailableAt = await tableHasColumn('payment_distributions', 'available_at')

        // Seller distributions (grouped)
        for (const [sellerRecipientId, amount] of sellerTotals.entries()) {
          if (!sellerRecipientId) continue
          const row: any = {
            transaction_id: transaction.id,
            recipient_type: 'seller',
            recipient_id: sellerRecipientId,
            amount,
            percentage: 0,
          }

          // Hold seller funds to reduce non-shipment / fraud risk. Release is handled by a separate job
          // that checks the 14-day window and shipping status.
          if (paymentDistributionsHasAvailableAt) {
            row.status = 'held'
            row.available_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
            row.hold_reason = 'payout_delay_14d_and_shipped'
          } else {
            row.status = 'held'
          }

          distributions.push(row)
        }

        // Affiliate distributions (grouped)
        for (const [affiliateRecipientId, amount] of affiliateTotals.entries()) {
          if (!affiliateRecipientId) continue
          distributions.push({
            transaction_id: transaction.id,
            recipient_type: 'affiliate',
            recipient_id: affiliateRecipientId,
            amount,
            percentage: 0,
            status: 'pending'
          })
        }

        // Platform distribution (net + remainder)
        distributions.push({
          transaction_id: transaction.id,
          recipient_type: 'platform',
          recipient_id: null,
          amount: platformAmount,
          percentage: 0,
          status: 'completed'
        })

        // Internal platform allocations (tax escrow, shipping reserve, Beezio fee, etc).
        // These rows are for accounting/automation and do not affect seller/affiliate payouts.
        try {
          const allocations: any[] = []

          if (taxAmount > 0) {
            allocations.push({
              stripe_payment_intent_id: paymentIntent.id,
              order_id: beezioOrderId,
              transaction_id: transaction.id,
              allocation_type: 'sales_tax',
              amount: taxAmount,
              currency: paymentIntent.currency?.toUpperCase?.() || 'USD',
              metadata: { basis: 'checkout' },
            })
          }

          if (shippingAmount > 0) {
            allocations.push({
              stripe_payment_intent_id: paymentIntent.id,
              order_id: beezioOrderId,
              transaction_id: transaction.id,
              allocation_type: 'shipping_reserve',
              amount: shippingAmount,
              currency: paymentIntent.currency?.toUpperCase?.() || 'USD',
              metadata: { basis: 'checkout' },
            })
          }

          if (cjCogsTotal > 0) {
            allocations.push({
              stripe_payment_intent_id: paymentIntent.id,
              order_id: beezioOrderId,
              transaction_id: transaction.id,
              allocation_type: 'cogs_reserve',
              amount: cjCogsTotal,
              currency: paymentIntent.currency?.toUpperCase?.() || 'USD',
              metadata: { provider: 'CJ', items: cjCogsLineItems },
            })

            allocations.push({
              stripe_payment_intent_id: paymentIntent.id,
              order_id: beezioOrderId,
              transaction_id: transaction.id,
              allocation_type: 'purchasing_reserve_total',
              amount: round2(cjCogsTotal + Math.max(shippingAmount, 0)),
              currency: paymentIntent.currency?.toUpperCase?.() || 'USD',
              metadata: { note: 'COGS reserve + shipping reserve (CJ only)' },
            })
          }

          if (beezioFeeTotal > 0) {
            allocations.push({
              stripe_payment_intent_id: paymentIntent.id,
              order_id: beezioOrderId,
              transaction_id: transaction.id,
              allocation_type: 'beezio_fee_gross',
              amount: beezioFeeTotal,
              currency: paymentIntent.currency?.toUpperCase?.() || 'USD',
              metadata: { note: 'Sum of per-item platformFee (or computed fallback)' },
            })
          }

          if (referralTotal > 0) {
            allocations.push({
              stripe_payment_intent_id: paymentIntent.id,
              order_id: beezioOrderId,
              transaction_id: transaction.id,
              allocation_type: 'referrer_bonus_total',
              amount: referralTotal,
              currency: paymentIntent.currency?.toUpperCase?.() || 'USD',
              metadata: { rule: '0.05 * beezio_fee_gross (per item)' },
            })
          }

          allocations.push({
            stripe_payment_intent_id: paymentIntent.id,
            order_id: beezioOrderId,
            transaction_id: transaction.id,
            allocation_type: 'platform_retain_merchandise',
            amount: platformAmount,
            currency: paymentIntent.currency?.toUpperCase?.() || 'USD',
            metadata: { note: 'Platform retained amount excluding tax+shipping' },
          })

          if (allocations.length) {
            const { error: allocError } = await supabase
              .from('platform_financial_allocations')
              .insert(allocations)
            if (allocError) {
              console.warn('Failed to write platform_financial_allocations (non-blocking):', allocError)
            }
          }
        } catch (e) {
          console.warn('Failed to record platform allocations (non-blocking):', e)
        }

        // Insert payment distributions using whichever linkage column exists
        const paymentDistributionsUsesTransactionId = await tableHasColumn('payment_distributions', 'transaction_id')
        const paymentDistributionsUsesOrderId = await tableHasColumn('payment_distributions', 'order_id')

        const distributionsToInsert = distributions
          .map((d) => {
            const row: any = { ...d }
            if (!paymentDistributionsUsesTransactionId) {
              delete row.transaction_id
            }
            if (paymentDistributionsUsesOrderId && beezioOrderId) {
              row.order_id = beezioOrderId
            }
            return row
          })
          .filter((row) => {
            if (paymentDistributionsUsesOrderId && !beezioOrderId) return false
            if (paymentDistributionsUsesTransactionId && !row.transaction_id) return false
            return true
          })

        const { error: distributionError } = distributionsToInsert.length
          ? await supabase
              .from('payment_distributions')
              .insert(distributionsToInsert)
          : { error: null as any }

        if (distributionError) {
          console.error('Error creating payment distributions:', distributionError)
          throw distributionError
        }

        // Record platform revenue
        const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
        try {
          const platformRevenueUsesTransactionId = await tableHasColumn('platform_revenue', 'transaction_id')
          const platformRevenueUsesOrderId = await tableHasColumn('platform_revenue', 'order_id')

          const revenueRow: any = {
            amount: platformAmount,
            revenue_type: 'commission',
            month_year: currentMonth,
          }
          if (platformRevenueUsesTransactionId) {
            revenueRow.transaction_id = transaction.id
          } else if (platformRevenueUsesOrderId && beezioOrderId) {
            revenueRow.order_id = beezioOrderId
          }

          const { error: revenueError } = await supabase
            .from('platform_revenue')
            .insert(revenueRow)

          if (revenueError) {
            console.error('Error recording platform revenue:', revenueError)
          }
        } catch (e) {
          console.error('Error recording platform revenue:', e)
        }

        // Update order status
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            status: 'completed',
            payment_status: 'paid',
            fulfillment_status: 'processing', // Set to processing to trigger automation
            updated_at: new Date().toISOString()
          })
          .eq('stripe_payment_intent_id', paymentIntent.id)

        if (orderError) {
          console.error('Error updating order:', orderError)
        }

        // Trigger automated order fulfillment
        try {
          const { data: orderData } = await supabase
            .from('orders')
            .select('id')
            .eq('stripe_payment_intent_id', paymentIntent.id)
            .single()

          if (orderData) {
            console.log('Triggering automated fulfillment for order:', orderData.id)

            // Call the automated fulfillment function
            const fulfillmentResponse = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/automated-order-fulfillment`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify({ orderId: orderData.id }),
              }
            )

            if (!fulfillmentResponse.ok) {
              console.error('Failed to trigger automated fulfillment:', await fulfillmentResponse.text())
            } else {
              console.log('Automated fulfillment triggered successfully')
            }

            // Trigger CJ Dropshipping fulfillment for dropship products
            try {
              console.log('Triggering CJ fulfillment for order:', orderData.id)
              const cjResponse = await fetch(
                `${Deno.env.get('NETLIFY_FUNCTIONS_URL') || 'https://beezio.co'}/.netlify/functions/cj-fulfill-order`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ orderId: orderData.id }),
                }
              )

              if (!cjResponse.ok) {
                const errorText = await cjResponse.text()
                console.error('Failed to trigger CJ fulfillment:', errorText)
              } else {
                const cjResult = await cjResponse.json()
                console.log('CJ fulfillment response:', cjResult)
              }
            } catch (cjError) {
              console.error('Error triggering CJ fulfillment:', cjError)
              // Don't throw - CJ fulfillment failure shouldn't block the webhook
            }
          }
        } catch (error) {
          console.error('Error triggering automated fulfillment:', error)
          // Don't throw here - we don't want to fail the webhook if fulfillment fails
        }

        // Payouts are NOT triggered from the webhook.
        // Sellers + affiliates are paid on the bi-monthly payout schedule (with seller holds/release rules).

        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        
        // Update transaction status
        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .eq('stripe_payment_intent_id', paymentIntent.id)

        // Update order status
        await supabase
          .from('orders')
          .update({ 
            status: 'failed',
            payment_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_payment_intent_id', paymentIntent.id)

        try {
          await supabase
            .from('checkout_intents')
            .update({ status: 'failed' })
            .eq('stripe_payment_intent_id', paymentIntent.id)
        } catch {
          // non-fatal
        }

        break
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent

        await supabase
          .from('transactions')
          .update({ status: 'canceled' })
          .eq('stripe_payment_intent_id', paymentIntent.id)

        await supabase
          .from('orders')
          .update({
            status: 'canceled',
            payment_status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', paymentIntent.id)

        try {
          await supabase
            .from('checkout_intents')
            .update({ status: 'failed' })
            .eq('stripe_payment_intent_id', paymentIntent.id)
        } catch {
          // non-fatal: checkout_intents table may not exist in some deployments
        }

        break
      }

      case 'refund.created':
      case 'refund.updated': {
        const refund = event.data.object as Stripe.Refund

        const paymentIntentId = typeof refund.payment_intent === 'string' ? refund.payment_intent : null
        const chargeId = typeof refund.charge === 'string' ? refund.charge : null

        if (paymentIntentId) {
          await supabase
            .from('transactions')
            .update({ status: 'refunded' })
            .eq('stripe_payment_intent_id', paymentIntentId)

          await supabase
            .from('orders')
            .update({
              status: 'refunded',
              payment_status: 'refunded',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_payment_intent_id', paymentIntentId)
        } else if (chargeId) {
          await supabase
            .from('transactions')
            .update({ status: 'refunded' })
            .eq('stripe_charge_id', chargeId)

          await supabase
            .from('orders')
            .update({
              status: 'refunded',
              payment_status: 'refunded',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_charge_id', chargeId)
        }

        break
      }

      case 'charge.dispute.created':
      case 'charge.dispute.updated':
      case 'charge.dispute.closed':
      case 'charge.dispute.funds_withdrawn':
      case 'charge.dispute.funds_reinstated': {
        const dispute = event.data.object as Stripe.Dispute
        const chargeId = typeof dispute.charge === 'string' ? dispute.charge : null
        const nextStatus =
          event.type === 'charge.dispute.closed'
            ? String((dispute as any)?.status || 'closed').toLowerCase()
            : 'disputed'

        if (chargeId) {
          await supabase
            .from('transactions')
            .update({ status: nextStatus })
            .eq('stripe_charge_id', chargeId)

          await supabase
            .from('orders')
            .update({
              status: nextStatus,
              payment_status: 'disputed',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_charge_id', chargeId)
        }

        break
      }

      case 'transfer.created':
      case 'transfer.updated':
      case 'transfer.reversed':
      // Legacy/non-standard event names; keep for backward compatibility if they ever appear.
      case 'transfer.paid':
      case 'transfer.failed': {
        const transfer = event.data.object as Stripe.Transfer

        // Stripe Transfer events track movement to connected accounts (not bank payout timing).
        // Treat `created/updated` as completed for our internal "transfer recorded" state.
        const status =
          event.type === 'transfer.reversed' ? 'reversed' :
          event.type === 'transfer.failed' ? 'failed' :
          'completed'
        
        await supabase
          .from('payouts')
          .update({ 
            status,
            completed_at: status === 'completed' ? new Date().toISOString() : null,
            failure_reason:
              event.type === 'transfer.reversed' ? 'transfer_reversed' :
              event.type === 'transfer.failed' ? transfer.failure_message :
              null
          })
          .eq('stripe_transfer_id', transfer.id)

        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

// Function to initiate automatic payouts for users with sufficient balance
async function initiateAutomaticPayouts(supabase: any, stripe: Stripe) {
  const MINIMUM_PAYOUT_AMOUNT = 25 // Minimum $25 for payout
  
  try {
    // Get users with sufficient balance for payout
    const { data: eligibleUsers, error } = await supabase
      .from('user_earnings')
      .select(`
        user_id,
        role,
        current_balance,
        profiles!inner(stripe_account_id, full_name, email)
      `)
      .gte('current_balance', MINIMUM_PAYOUT_AMOUNT)
      .not('profiles.stripe_account_id', 'is', null)

    if (error) {
      console.error('Error fetching eligible users:', error)
      return
    }

    if (!eligibleUsers?.length) {
      console.log('No users eligible for automatic payout')
      return
    }

    console.log(`Processing automatic payouts for ${eligibleUsers.length} users`)

    // Create payout batch
    const batchNumber = `AUTO_${Date.now()}`
    const totalBatchAmount = eligibleUsers.reduce((sum: number, user: any) => sum + user.current_balance, 0)

    const { data: batch, error: batchError } = await supabase
      .from('payout_batches')
      .insert({
        batch_number: batchNumber,
        total_amount: totalBatchAmount,
        recipient_count: eligibleUsers.length,
        status: 'processing'
      })
      .select()
      .single()

    if (batchError) {
      console.error('Error creating payout batch:', batchError)
      return
    }

    // Process individual payouts
    for (const user of eligibleUsers) {
      try {
        // Create Stripe transfer
        const transfer = await stripe.transfers.create({
          amount: Math.round(user.current_balance * 100), // Convert to cents
          currency: 'usd',
          destination: user.profiles.stripe_account_id,
          description: `Payout for ${user.role} earnings - Batch ${batchNumber}`
        })

        // Record payout
        await supabase
          .from('payouts')
          .insert({
            batch_id: batch.id,
            user_id: user.user_id,
            amount: user.current_balance,
            stripe_transfer_id: transfer.id,
            status: 'completed'
          })

        // Update user earnings
        await supabase
          .from('user_earnings')
          .update({
            paid_out: supabase.sql`paid_out + ${user.current_balance}`,
            pending_payout: supabase.sql`pending_payout - ${user.current_balance}`,
            current_balance: 0,
            last_payout_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.user_id)
          .eq('role', user.role)

        console.log(`Payout completed for user ${user.user_id}: $${user.current_balance}`)

      } catch (transferError) {
        console.error(`Error processing payout for user ${user.user_id}:`, transferError)
        
        // Record failed payout
        await supabase
          .from('payouts')
          .insert({
            batch_id: batch.id,
            user_id: user.user_id,
            amount: user.current_balance,
            status: 'failed',
            failure_reason: (transferError as Error).message
          })
      }
    }

    // Update batch status
    await supabase
      .from('payout_batches')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', batch.id)

  } catch (error) {
    console.error('Error in automatic payouts:', error)
  }
}
