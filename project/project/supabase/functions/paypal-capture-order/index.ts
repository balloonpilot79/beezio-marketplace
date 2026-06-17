import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

type CaptureItem = {
  productId: string
  quantity: number
  salePrice: number
  sellerId: string
  partnerId?: string | null
  partnerCommissionPercent?: number | null
}

type ProductCommissionConfig = {
  partnerPercent: number
  flatAmount: number | null
  commissionType: string
}

const PLATFORM_FEE_PERCENT = 15
const DEFAULT_INFLUENCER_PERCENT = 5
const HOLD_DAYS = 14

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const safeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeCommissionType = (value: unknown) => String(value || '').trim().toLowerCase()

const isFlatCommissionType = (value: unknown) => {
  const normalized = normalizeCommissionType(value)
  return normalized === 'flat' || normalized === 'flat_rate' || normalized === 'fixed'
}

const calcPayout = (params: {
  saleAmount: number
  partnerPercent: number
  partnerFlatAmount?: number | null
  influencerPercent: number
  platformPercent: number
  hasInfluencer: boolean
}) => {
  const partnerEarnings = params.partnerFlatAmount !== null && params.partnerFlatAmount !== undefined
    ? round2(Math.max(0, params.partnerFlatAmount))
    : round2(params.saleAmount * (params.partnerPercent / 100))

  // LOCKED MODEL (PayPal-approved): platform fee is always 15% of gross sale amount.
  // If an influencer is involved: influencer receives 5% and Beezio keeps 10%.
  // If no influencer: Beezio keeps the full 15%.
  const platformTotal = round2(params.saleAmount * (params.platformPercent / 100))
  const influencerRate = Math.min(params.influencerPercent, params.platformPercent)
  const influencerEarnings = params.hasInfluencer
    ? round2(params.saleAmount * (influencerRate / 100))
    : 0
  const beezioFee = round2(platformTotal - influencerEarnings)
  const sellerEarnings = round2(params.saleAmount - partnerEarnings - platformTotal)

  return {
    sellerEarnings: Math.max(sellerEarnings, 0),
    partnerEarnings: Math.max(partnerEarnings, 0),
    influencerEarnings: Math.max(influencerEarnings, 0),
    beezioFee: Math.max(beezioFee, 0),
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const body = await req.json()
    const buyerId = String(body?.buyerId || '').trim()
    const paypalCaptureId = String(body?.paypalCaptureId || '').trim()
    const providerOrderId = String(
      body?.providerOrderId ||
      body?.paypalOrderId ||
      body?.orderToken ||
      body?.token ||
      ''
    ).trim()
    const items = Array.isArray(body?.items) ? (body.items as CaptureItem[]) : []
    const currency = String(body?.currency || 'USD').toUpperCase()
    const billingDetails = body?.billingDetails || {}
    const taxAmount = Number(body?.taxAmount ?? 0) || 0
    const shippingAmount = Number(body?.shippingAmount ?? 0) || 0
    const paypalFeeEstimate = body?.paypalFeeEstimate ?? null

    if (!buyerId) return json(400, { error: 'Missing buyerId' })
    if (!paypalCaptureId) return json(400, { error: 'Missing paypalCaptureId' })
    if (!items.length) return json(400, { error: 'No items supplied' })

    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
      Deno.env.get('SERVICE_ROLE_KEY') ??
      ''

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    )

    const columnCache = new Map<string, boolean>()
    const tableHasColumn = async (tableName: string, columnName: string): Promise<boolean> => {
      const cacheKey = `${tableName}.${columnName}`
      if (columnCache.has(cacheKey)) return Boolean(columnCache.get(cacheKey))

      try {
        const { data, error } = await supabase
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .eq('column_name', columnName)
          .limit(1)
          .maybeSingle()

        const exists = !error && Boolean(data)
        columnCache.set(cacheKey, exists)
        return exists
      } catch {
        columnCache.set(cacheKey, false)
        return false
      }
    }

    const tableExists = async (tableName: string): Promise<boolean> => {
      const cacheKey = `${tableName}.__exists__`
      if (columnCache.has(cacheKey)) return Boolean(columnCache.get(cacheKey))

      try {
        const { data, error } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .limit(1)
          .maybeSingle()

        const exists = !error && Boolean(data)
        columnCache.set(cacheKey, exists)
        return exists
      } catch {
        columnCache.set(cacheKey, false)
        return false
      }
    }

    const orderId = String(body?.orderId || '').trim() || crypto.randomUUID()

    const sellerId = String(items[0]?.sellerId || '').trim()
    const partnerId = String(items[0]?.partnerId || '').trim() || null

    const influencerPercent = Number(Deno.env.get('INFLUENCER_RATE_PERCENT') ?? DEFAULT_INFLUENCER_PERCENT)
    const platformPercent = Number(Deno.env.get('PLATFORM_FEE_PERCENT') ?? PLATFORM_FEE_PERCENT)

    // Resolve partner commission defaults + influencer attribution once.
    let defaultPartnerPercent: number | null = null
    if (sellerId) {
      const { data: sellerRow } = await supabase
        .from('sellers')
        .select('default_partner_commission_percent')
        .eq('id', sellerId)
        .maybeSingle()
      const val = Number((sellerRow as any)?.default_partner_commission_percent)
      defaultPartnerPercent = Number.isFinite(val) ? val : null
    }

    let influencerId: string | null = null
    if (partnerId) {
      const { data: partnerProfile } = await supabase
        .from('profiles')
        .select('recruited_by_influencer_id')
        .eq('id', partnerId)
        .maybeSingle()
      influencerId = (partnerProfile as any)?.recruited_by_influencer_id ?? null
    }

    let grossAmount = 0
    let partnerEarnings = 0
    let influencerEarnings = 0
    let beezioFee = 0
    const productCommissionCache = new Map<string, ProductCommissionConfig>()

    for (const item of items) {
      const qty = Number.isFinite(item?.quantity) ? Number(item.quantity) : 0
      const unitPrice = Number.isFinite(item?.salePrice) ? Number(item.salePrice) : 0
      if (qty <= 0 || unitPrice <= 0) continue

      let productCommission = productCommissionCache.get(item.productId)
      if (!productCommission) {
        const { data: productRow } = await supabase
          .from('products')
          .select('partner_commission_percent,affiliate_commission_type,affiliate_commission_value,commission_type,flat_commission_amount')
          .eq('id', item.productId)
          .maybeSingle()

        const partnerPercentValue = Number((productRow as any)?.partner_commission_percent)
        const affiliateCommissionValue = Number((productRow as any)?.affiliate_commission_value)
        const flatCommissionAmount = Number((productRow as any)?.flat_commission_amount)
        const commissionType = normalizeCommissionType(
          (productRow as any)?.affiliate_commission_type || (productRow as any)?.commission_type
        )

        productCommission = {
          partnerPercent: Number.isFinite(partnerPercentValue) ? partnerPercentValue : defaultPartnerPercent ?? 0,
          flatAmount: isFlatCommissionType(commissionType)
            ? (Number.isFinite(affiliateCommissionValue)
                ? affiliateCommissionValue
                : Number.isFinite(flatCommissionAmount)
                ? flatCommissionAmount
                : null)
            : null,
          commissionType,
        }

        productCommissionCache.set(item.productId, productCommission)
      }

      const partnerPercent = productCommission.flatAmount !== null
        ? 0
        : Number.isFinite(item?.partnerCommissionPercent)
        ? Number(item.partnerCommissionPercent)
        : productCommission.partnerPercent

      const lineAmount = unitPrice * qty
      const payout = calcPayout({
        saleAmount: lineAmount,
        partnerPercent: partnerPercent ?? 0,
        partnerFlatAmount: productCommission.flatAmount,
        influencerPercent,
        platformPercent,
        hasInfluencer: Boolean(partnerId && influencerId),
      })

      grossAmount += lineAmount
      partnerEarnings += payout.partnerEarnings
      influencerEarnings += payout.influencerEarnings
      beezioFee += payout.beezioFee
    }

    grossAmount = round2(grossAmount)
    partnerEarnings = round2(partnerEarnings)
    influencerEarnings = round2(influencerEarnings)
    beezioFee = round2(beezioFee)

    const sellerEarnings = round2(grossAmount - partnerEarnings - influencerEarnings - beezioFee)
    const totalAmount = round2(grossAmount + taxAmount + shippingAmount)

    const holdReleaseAt = new Date(Date.now() + HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const ordersHasProviderOrderId = await tableHasColumn('orders', 'provider_order_id')
    const ordersHasProviderCaptureId = await tableHasColumn('orders', 'provider_capture_id')

    const { error: orderError } = await supabase
      .from('orders')
      .insert({
        id: orderId,
        buyer_id: buyerId,
        seller_id: sellerId || null,
        partner_id: partnerId,
        influencer_id: influencerId,
        total_amount: totalAmount,
        items_subtotal: grossAmount,
        tax_amount: taxAmount,
        shipping_amount: shippingAmount,
        currency,
        status: 'completed',
        payment_status: 'paid',
        payment_provider: 'PAYPAL',
        ...(ordersHasProviderOrderId ? { provider_order_id: providerOrderId || null } : {}),
        ...(ordersHasProviderCaptureId ? { provider_capture_id: paypalCaptureId || null } : {}),
        billing_name: billingDetails?.name ?? null,
        billing_email: billingDetails?.email ?? null,
      })

    if (orderError) {
      throw new Error(`Failed to create order: ${orderError.message}`)
    }

    const orderItems = items.map((item) => ({
      order_id: orderId,
      product_id: item.productId,
      quantity: item.quantity,
      price: item.salePrice,
      final_sale_price_per_unit: item.salePrice,
      seller_ask_price_per_unit: item.salePrice,
      affiliate_commission_percent_at_purchase: item.partnerCommissionPercent ?? 0,
      platform_percent_at_purchase: platformPercent,
    }))

    if (orderItems.length) {
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
      if (itemsError) {
        throw new Error(`Failed to create order items: ${itemsError.message}`)
      }
    }

    const { error: ledgerError } = await supabase
      .from('payout_ledger')
      .insert({
        order_id: orderId,
        seller_id: sellerId || null,
        partner_id: partnerId,
        influencer_id: influencerId,
        gross_amount: grossAmount,
        seller_earnings: sellerEarnings,
        partner_earnings: partnerEarnings,
        influencer_earnings: influencerEarnings,
        beezio_fee: beezioFee,
        paypal_fee_estimate: paypalFeeEstimate,
        status: 'PENDING_HOLD',
        hold_release_at: holdReleaseAt,
        notes: paypalCaptureId ? `paypal_capture_id=${paypalCaptureId}` : null,
      })

    if (ledgerError) {
      throw new Error(`Failed to create payout ledger: ${ledgerError.message}`)
    }

    try {
      if (await tableExists('payment_distributions')) {
        const paymentDistributionsHasOrderId = await tableHasColumn('payment_distributions', 'order_id')
        const paymentDistributionsHasTransactionId = await tableHasColumn('payment_distributions', 'transaction_id')
        const paymentDistributionsHasAvailableAt = await tableHasColumn('payment_distributions', 'available_at')
        const paymentDistributionsHasHoldReason = await tableHasColumn('payment_distributions', 'hold_reason')

        const distributionRows: Array<Record<string, unknown>> = []

        if (sellerId && sellerEarnings > 0) {
          distributionRows.push({
            recipient_type: 'seller',
            recipient_id: sellerId,
            amount: sellerEarnings,
            percentage: 0,
            status: 'held',
            ...(paymentDistributionsHasOrderId ? { order_id: orderId } : {}),
            ...(paymentDistributionsHasAvailableAt ? { available_at: holdReleaseAt } : {}),
            ...(paymentDistributionsHasHoldReason ? { hold_reason: 'paypal_capture_hold_14d' } : {}),
          })
        }

        if (partnerId && partnerEarnings > 0) {
          distributionRows.push({
            recipient_type: 'affiliate',
            recipient_id: partnerId,
            amount: partnerEarnings,
            percentage: 0,
            status: 'pending',
            ...(paymentDistributionsHasOrderId ? { order_id: orderId } : {}),
          })
        }

        if (distributionRows.length) {
          const { error: distributionsError } = await supabase.from('payment_distributions').insert(distributionRows)
          if (distributionsError) {
            console.warn('paypal-capture-order: failed to create payment_distributions rows', distributionsError)
          }
        }
      }
    } catch (distributionError) {
      console.warn('paypal-capture-order: compatibility payment_distributions write failed', distributionError)
    }

    try {
      if (await tableExists('user_earnings')) {
        const userEarningsHasHeldBalance = await tableHasColumn('user_earnings', 'held_balance')
        const userEarningsHasCurrentBalance = await tableHasColumn('user_earnings', 'current_balance')
        const userEarningsHasPendingPayout = await tableHasColumn('user_earnings', 'pending_payout')
        const userEarningsHasTotalEarned = await tableHasColumn('user_earnings', 'total_earned')
        const userEarningsHasPaidOut = await tableHasColumn('user_earnings', 'paid_out')
        const userEarningsHasUpdatedAt = await tableHasColumn('user_earnings', 'updated_at')
        const updatedAt = new Date().toISOString()
        const userEarningsSelectFields = [
          userEarningsHasTotalEarned ? 'total_earned' : null,
          userEarningsHasCurrentBalance ? 'current_balance' : null,
          userEarningsHasPendingPayout ? 'pending_payout' : null,
          userEarningsHasPaidOut ? 'paid_out' : null,
          userEarningsHasHeldBalance ? 'held_balance' : null,
        ].filter(Boolean).join(', ')

        const upsertEarnings = async (userId: string, role: 'seller' | 'affiliate', amount: number, held: boolean) => {
          if (!userId || amount <= 0) return

          const existingRow = userEarningsSelectFields
            ? (await supabase
                .from('user_earnings')
                .select(userEarningsSelectFields)
                .eq('user_id', userId)
                .eq('role', role)
                .maybeSingle()).data
            : null

          const nextRow: Record<string, unknown> = {
            user_id: userId,
            role,
          }

          if (userEarningsHasTotalEarned) {
            nextRow.total_earned = round2(safeNumber((existingRow as any)?.total_earned) + amount)
          }

          if (held && userEarningsHasHeldBalance) {
            nextRow.held_balance = round2(safeNumber((existingRow as any)?.held_balance) + amount)
          } else if (userEarningsHasCurrentBalance) {
            nextRow.current_balance = round2(safeNumber((existingRow as any)?.current_balance) + amount)
          }

          if (!held && userEarningsHasPendingPayout) {
            nextRow.pending_payout = round2(safeNumber((existingRow as any)?.pending_payout) + amount)
          } else if (held && !userEarningsHasHeldBalance && userEarningsHasPendingPayout) {
            nextRow.pending_payout = round2(safeNumber((existingRow as any)?.pending_payout) + amount)
          }

          if (userEarningsHasPaidOut) {
            nextRow.paid_out = safeNumber((existingRow as any)?.paid_out)
          }

          if (userEarningsHasUpdatedAt) {
            nextRow.updated_at = updatedAt
          }

          const { error: earningsError } = await supabase
            .from('user_earnings')
            .upsert(nextRow, { onConflict: 'user_id,role' })

          if (earningsError) {
            console.warn('paypal-capture-order: failed to upsert user_earnings row', { userId, role, earningsError })
          }
        }

        await upsertEarnings(sellerId, 'seller', sellerEarnings, true)
        await upsertEarnings(partnerId || '', 'affiliate', partnerEarnings, false)
      }
    } catch (earningsError) {
      console.warn('paypal-capture-order: compatibility user_earnings write failed', earningsError)
    }

    try {
      if (await tableExists('payout_snapshots')) {
        const payoutSnapshotsHasOrderId = await tableHasColumn('payout_snapshots', 'order_id')
        const payoutSnapshotsHasOrderNumber = await tableHasColumn('payout_snapshots', 'order_number')
        const payoutSnapshotsHasCurrency = await tableHasColumn('payout_snapshots', 'currency')
        const payoutSnapshotsHasProviderOrderId = await tableHasColumn('payout_snapshots', 'provider_order_id')
        const payoutSnapshotsHasProviderCaptureId = await tableHasColumn('payout_snapshots', 'provider_capture_id')
        const payoutSnapshotsHasHoldReleaseAt = await tableHasColumn('payout_snapshots', 'hold_release_at')
        const payoutSnapshotsHasSnapshot = await tableHasColumn('payout_snapshots', 'snapshot')

        const makeSnapshotRow = (payeeUserId: string | null, payeeRole: 'SELLER' | 'PARTNER' | 'INFLUENCER', amount: number) => {
          if (!payeeUserId || amount <= 0) return null

          const row: Record<string, unknown> = {
            payee_user_id: payeeUserId,
            payee_role: payeeRole,
            amount,
            status: 'PENDING_HOLD',
            ...(payoutSnapshotsHasOrderId ? { order_id: orderId } : {}),
            ...(payoutSnapshotsHasOrderNumber ? { order_number: null } : {}),
            ...(payoutSnapshotsHasCurrency ? { currency } : {}),
            ...(payoutSnapshotsHasProviderOrderId ? { provider_order_id: providerOrderId || null } : {}),
            ...(payoutSnapshotsHasProviderCaptureId ? { provider_capture_id: paypalCaptureId || null } : {}),
            ...(payoutSnapshotsHasHoldReleaseAt ? { hold_release_at: holdReleaseAt } : {}),
            ...(payoutSnapshotsHasSnapshot ? {
              snapshot: {
                order_id: orderId,
                payee_user_id: payeeUserId,
                payee_role: payeeRole,
                amount,
                seller_id: sellerId || null,
                partner_id: partnerId,
                influencer_id: influencerId,
                gross_amount: grossAmount,
                seller_earnings: sellerEarnings,
                partner_earnings: partnerEarnings,
                influencer_earnings: influencerEarnings,
                beezio_fee: beezioFee,
                shipping_amount: shippingAmount,
                tax_amount: taxAmount,
                hold_release_at: holdReleaseAt,
                provider_order_id: providerOrderId || null,
                provider_capture_id: paypalCaptureId || null,
              },
            } : {}),
          }

          return row
        }

        const snapshotRows = [
          makeSnapshotRow(sellerId || null, 'SELLER', sellerEarnings),
          makeSnapshotRow(partnerId, 'PARTNER', partnerEarnings),
          makeSnapshotRow(influencerId, 'INFLUENCER', influencerEarnings),
        ].filter(Boolean) as Array<Record<string, unknown>>

        if (snapshotRows.length) {
          const { error: snapshotsError } = await supabase.from('payout_snapshots').insert(snapshotRows)
          if (snapshotsError) {
            console.warn('paypal-capture-order: failed to create payout_snapshots rows', snapshotsError)
          }
        }
      }
    } catch (snapshotError) {
      console.warn('paypal-capture-order: payout_snapshots write failed', snapshotError)
    }

    return json(200, {
      ok: true,
      order_id: orderId,
      hold_release_at: holdReleaseAt,
      payout: {
        gross_amount: grossAmount,
        seller_earnings: sellerEarnings,
        partner_earnings: partnerEarnings,
        influencer_earnings: influencerEarnings,
        beezio_fee: beezioFee,
      },
    })
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : String(error) })
  }
})
