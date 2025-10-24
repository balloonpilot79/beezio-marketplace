// SYNC EXTERNAL PRODUCTS - Import products from supplier APIs
// This Edge Function syncs products from external suppliers to your store

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { connection_id, provider } = await req.json()

    console.log(`🔄 Syncing products from ${provider}`)

    // 1. Get API connection details
    const { data: connection, error: connError } = await supabase
      .from('api_connections')
      .select('*')
      .eq('id', connection_id)
      .single()

    if (connError) throw connError

    let products = []

    // 2. Fetch products based on provider
    switch (provider.toLowerCase()) {
      case 'printful':
        products = await syncPrintfulProducts(connection.api_key)
        break
      case 'printify':
        products = await syncPrintifyProducts(connection.api_key, connection.store_id)
        break
      case 'shopify':
        products = await syncShopifyProducts(connection.api_key, connection.store_id)
        break
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }

    console.log(`Found ${products.length} products to sync`)

    // 3. Insert/update products in database
    let syncedCount = 0
    const errors = []

    for (const product of products) {
      try {
        const { error: insertError } = await supabase
          .from('products')
          .upsert({
            seller_id: connection.seller_id,
            title: product.title,
            description: product.description,
            price: product.price,
            images: product.images,
            category: product.category || 'Other',
            supplier_info: {
              supplier_name: provider,
              supplier_product_id: product.supplier_product_id,
              supplier_url: product.supplier_url,
              is_dropshipped: true
            },
            sku: product.sku,
            stock_quantity: 9999, // Dropshipped products have unlimited stock
            affiliate_commission_rate: 15, // Default 15%
            status: 'active',
            created_at: new Date().toISOString()
          }, {
            onConflict: 'sku'
          })

        if (insertError) {
          errors.push({ product: product.title, error: insertError.message })
        } else {
          syncedCount++
        }
      } catch (err) {
        errors.push({ product: product.title, error: err.message })
      }
    }

    // 4. Update connection status
    await supabase
      .from('api_connections')
      .update({
        last_sync: new Date().toISOString(),
        products_synced: syncedCount,
        status: 'connected'
      })
      .eq('id', connection_id)

    console.log(`✅ Synced ${syncedCount} products`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced_count: syncedCount,
        total_products: products.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error syncing products:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

// Provider-specific sync functions

async function syncPrintfulProducts(apiKey: string) {
  const response = await fetch('https://api.printful.com/store/products', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })

  const data = await response.json()
  
  return data.result?.map((item: any) => ({
    title: item.name,
    description: item.name, // Printful doesn't provide descriptions in list
    price: item.retail_price || 29.99,
    images: [item.thumbnail_url],
    category: 'Fashion',
    supplier_product_id: item.id.toString(),
    supplier_url: `https://www.printful.com/dashboard/products/${item.id}`,
    sku: `PRINT-${item.id}`
  })) || []
}

async function syncPrintifyProducts(apiKey: string, storeId: string) {
  const response = await fetch(`https://api.printify.com/v1/shops/${storeId}/products.json`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })

  const data = await response.json()
  
  return data.data?.map((item: any) => ({
    title: item.title,
    description: item.description || item.title,
    price: item.variants?.[0]?.price / 100 || 29.99, // Convert cents to dollars
    images: item.images?.map((img: any) => img.src) || [],
    category: 'Fashion',
    supplier_product_id: item.id,
    supplier_url: `https://printify.com/app/products/${item.id}`,
    sku: `PRNT-${item.id}`
  })) || []
}

async function syncShopifyProducts(apiKey: string, storeId: string) {
  const response = await fetch(`https://${storeId}.myshopify.com/admin/api/2024-01/products.json`, {
    headers: {
      'X-Shopify-Access-Token': apiKey,
      'Content-Type': 'application/json'
    }
  })

  const data = await response.json()
  
  return data.products?.map((item: any) => ({
    title: item.title,
    description: item.body_html || item.title,
    price: parseFloat(item.variants?.[0]?.price || '29.99'),
    images: item.images?.map((img: any) => img.src) || [],
    category: item.product_type || 'Other',
    supplier_product_id: item.id.toString(),
    supplier_url: `https://${storeId}.myshopify.com/admin/products/${item.id}`,
    sku: item.variants?.[0]?.sku || `SHOP-${item.id}`
  })) || []
}
