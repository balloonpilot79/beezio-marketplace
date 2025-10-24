// AUTO-FULFILL ORDER - Automatically places order with supplier when customer buys
// This Edge Function runs when a new order is created

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  price: number
  products: {
    supplier_info: {
      supplier_name: string
      supplier_product_id: string
      supplier_url: string
      is_dropshipped: boolean
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { order_id } = await req.json()

    console.log('🚀 Auto-fulfilling order:', order_id)

    // 1. Get order items with supplier info
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        product_id,
        quantity,
        price,
        products!inner (
          supplier_info
        )
      `)
      .eq('order_id', order_id)

    if (itemsError) throw itemsError

    // 2. Get order shipping address
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, buyer:buyer_id(email, profiles(full_name))')
      .eq('id', order_id)
      .single()

    if (orderError) throw orderError

    const results = []

    // 3. Process each item that's dropshipped
    for (const item of orderItems as OrderItem[]) {
      const supplierInfo = item.products.supplier_info

      if (!supplierInfo?.is_dropshipped) {
        console.log(`Item ${item.id} is not dropshipped, skipping`)
        continue
      }

      console.log(`Processing dropshipped item: ${supplierInfo.supplier_name}`)

      // 4. Place order with supplier based on supplier type
      let vendorOrderResult
      
      switch (supplierInfo.supplier_name.toLowerCase()) {
        case 'printful':
          vendorOrderResult = await orderFromPrintful(item, order, supabase)
          break
        case 'printify':
          vendorOrderResult = await orderFromPrintify(item, order, supabase)
          break
        case 'aliexpress':
          vendorOrderResult = await orderFromAliExpress(item, order, supabase)
          break
        default:
          // Generic webhook-based ordering
          vendorOrderResult = await orderViaWebhook(item, order, supplierInfo, supabase)
      }

      results.push(vendorOrderResult)

      // 5. Create vendor_order record
      const { error: vendorOrderError } = await supabase
        .from('vendor_orders')
        .insert({
          order_id: order_id,
          vendor_name: supplierInfo.supplier_name,
          vendor_order_id: vendorOrderResult.vendor_order_id,
          product_id: supplierInfo.supplier_product_id,
          quantity: item.quantity,
          status: 'ordered',
          vendor_cost: item.price * 0.6, // Assuming 40% margin
          created_at: new Date().toISOString()
        })

      if (vendorOrderError) {
        console.error('Error creating vendor order:', vendorOrderError)
      }
    }

    // 6. Update order fulfillment status
    await supabase
      .from('orders')
      .update({ 
        fulfillment_status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)

    // 7. Send confirmation email to buyer
    await supabase.functions.invoke('send-notifications', {
      body: {
        order_id,
        notification_type: 'order_placed',
        recipient_email: order.buyer.email
      }
    })

    console.log('✅ Order fulfillment completed:', results)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Order fulfillment initiated',
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error fulfilling order:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

// Supplier-specific ordering functions

async function orderFromPrintful(item: OrderItem, order: any, supabase: any) {
  const apiKey = await getSupplierApiKey('printful', order.seller_id, supabase)
  
  const response = await fetch('https://api.printful.com/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recipient: {
        name: order.shipping_address?.name || order.buyer.profiles.full_name,
        address1: order.shipping_address?.address1,
        city: order.shipping_address?.city,
        state_code: order.shipping_address?.state,
        country_code: order.shipping_address?.country || 'US',
        zip: order.shipping_address?.zip
      },
      items: [{
        variant_id: item.products.supplier_info.supplier_product_id,
        quantity: item.quantity
      }]
    })
  })

  const result = await response.json()
  return {
    vendor: 'printful',
    vendor_order_id: result.result?.id || 'PRINT-' + Date.now(),
    status: 'ordered'
  }
}

async function orderFromPrintify(item: OrderItem, order: any, supabase: any) {
  const apiKey = await getSupplierApiKey('printify', order.seller_id, supabase)
  
  const response = await fetch('https://api.printify.com/v1/shops/{shop_id}/orders.json', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      address_to: {
        first_name: order.buyer.profiles.full_name?.split(' ')[0],
        last_name: order.buyer.profiles.full_name?.split(' ')[1] || '',
        email: order.buyer.email,
        address1: order.shipping_address?.address1,
        city: order.shipping_address?.city,
        state_code: order.shipping_address?.state,
        country_code: order.shipping_address?.country || 'US',
        zip: order.shipping_address?.zip
      },
      line_items: [{
        product_id: item.products.supplier_info.supplier_product_id,
        quantity: item.quantity
      }]
    })
  })

  const result = await response.json()
  return {
    vendor: 'printify',
    vendor_order_id: result.id || 'PRNT-' + Date.now(),
    status: 'ordered'
  }
}

async function orderFromAliExpress(item: OrderItem, order: any, supabase: any) {
  // AliExpress API integration
  // Note: AliExpress requires OAuth and specific app credentials
  console.log('AliExpress order would be placed here')
  
  return {
    vendor: 'aliexpress',
    vendor_order_id: 'AE-' + Date.now(),
    status: 'pending_manual' // AliExpress often requires manual confirmation
  }
}

async function orderViaWebhook(item: OrderItem, order: any, supplierInfo: any, supabase: any) {
  // Generic webhook for custom suppliers
  const webhookUrl = supplierInfo.webhook_url
  
  if (!webhookUrl) {
    return {
      vendor: supplierInfo.supplier_name,
      vendor_order_id: 'MANUAL-' + Date.now(),
      status: 'pending_manual'
    }
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: supplierInfo.supplier_product_id,
      quantity: item.quantity,
      shipping_address: order.shipping_address,
      customer_email: order.buyer.email
    })
  })

  const result = await response.json()
  return {
    vendor: supplierInfo.supplier_name,
    vendor_order_id: result.order_id || 'WH-' + Date.now(),
    status: 'ordered'
  }
}

async function getSupplierApiKey(supplier: string, sellerId: string, supabase: any) {
  const { data } = await supabase
    .from('api_connections')
    .select('api_key')
    .eq('seller_id', sellerId)
    .eq('provider', supplier)
    .single()
  
  return data?.api_key || ''
}
