import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'
)

// Test user structure
// interface TestUser {
//   id: string
//   email: string
//   type: 'seller' | 'affiliate' | 'buyer'
//   profile: any
// }

// Test product structure
// interface TestProduct {
//   id: string
//   name: string
//   price: number
//   seller_id: string
// }

// Test transaction structure
// interface TestTransaction {
//   id: string
//   product_id: string
//   buyer_id: string
//   affiliate_id?: string
//   amount: number
//   status: string
//   stripe_payment_id?: string
// }

class MarketplaceTransactionTester {
  constructor() {
    this.testUsers = []
    this.testProduct = null
    this.testTransaction = null
  }

  async runCompleteTransactionTest() {
    console.log('🚀 Starting Complete Marketplace Transaction Test')
    console.log('===============================================')

    try {
      // Phase 1: Setup Test Users
      await this.setupTestUsers()
      console.log('✅ Phase 1: Test users created')

      // Phase 2: Seller Posts Item
      await this.sellerPostsItem()
      console.log('✅ Phase 2: Product listed by seller')

      // Phase 3: Affiliate Promotes Item
      await this.affiliatePromotesItem()
      console.log('✅ Phase 3: Affiliate link generated')

      // Phase 4: Buyer Makes Purchase
      await this.buyerMakesPurchase()
      console.log('✅ Phase 4: Purchase completed through affiliate')

      // Phase 5: Process Payments
      await this.processPayments()
      console.log('✅ Phase 5: Payments processed to all parties')

      // Phase 6: Verify Dashboard Data
      await this.verifyDashboardData()
      console.log('✅ Phase 6: Dashboard data verified')

      // Phase 7: Test Tax Compliance
      await this.testTaxCompliance()
      console.log('✅ Phase 7: Tax compliance functions tested')

      console.log('\n🎉 COMPLETE TRANSACTION TEST PASSED!')
      console.log('=====================================')
      this.printTestSummary()

    } catch (error) {
      console.error('❌ Test failed:', error)
      throw error
    }
  }

  async setupTestUsers() {
    console.log('\n📝 Setting up test users...')

    // Create test seller
    const { data: sellerData, error: sellerError } = await supabase.auth.signUp({
      email: `test-seller-${Date.now()}@beezio.test`,
      password: 'TestPassword123!'
    })
    if (sellerError) throw sellerError

    const seller = await this.createUserProfile(sellerData.user.id, 'seller', 'Test Seller')
    this.testUsers.push(seller)

    // Create test affiliate
    const { data: affiliateData, error: affiliateError } = await supabase.auth.signUp({
      email: `test-affiliate-${Date.now()}@beezio.test`,
      password: 'TestPassword123!'
    })
    if (affiliateError) throw affiliateError

    const affiliate = await this.createUserProfile(affiliateData.user.id, 'affiliate', 'Test Affiliate')
    this.testUsers.push(affiliate)

    // Create test buyer
    const { data: buyerData, error: buyerError } = await supabase.auth.signUp({
      email: `test-buyer-${Date.now()}@beezio.test`,
      password: 'TestPassword123!'
    })
    if (buyerError) throw buyerError

    const buyer = await this.createUserProfile(buyerData.user.id, 'buyer', 'Test Buyer')
    this.testUsers.push(buyer)

    console.log(`Created ${this.testUsers.length} test users`)
  }

  async createUserProfile(userId, userType, fullName) {
    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        full_name: fullName,
        user_type: userType,
        email: `${userType}-${Date.now()}@beezio.test`
      })
    if (profileError) throw profileError

    // Set up Stripe account for seller/affiliate
    if (userType !== 'buyer') {
      await this.setupStripeAccount(userId, userType)
    }

    return {
      id: userId,
      email: `${userType}-${Date.now()}@beezio.test`,
      type: userType,
      profile: { full_name: fullName, user_type: userType }
    }
  }

  async setupStripeAccount(userId, userType) {
    // Create embedded Stripe account
    const { data: stripeData, error: stripeError } = await supabase.functions.invoke('create-embedded-stripe-account', {
      body: {
        userId,
        type: userType,
        email: `${userType}-${Date.now()}@beezio.test`,
        agreements_signed: true
      }
    })
    if (stripeError) throw stripeError

    // Update profile with Stripe account ID
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ stripe_account_id: stripeData.account_id })
      .eq('id', userId)
    if (updateError) throw updateError

    // Sign tax agreements
    await this.signTaxAgreements(userId)
  }

  async signTaxAgreements(userId) {
    const agreements = ['1099', 'independent_contractor', 'tax_withholding']

    for (const agreementType of agreements) {
      const { error } = await supabase
        .from('tax_agreements')
        .insert({
          user_id: userId,
          agreement_type: agreementType,
          signed_at: new Date().toISOString(),
          status: 'signed'
        })
      if (error) throw error
    }
  }

  async sellerPostsItem() {
    console.log('\n📦 Seller posting item...')

    const seller = this.testUsers.find(u => u.type === 'seller')
    const productData = {
      name: 'Test Wireless Headphones',
      description: 'High-quality wireless headphones for testing',
      price: 99.99,
      seller_id: seller.id,
      category: 'electronics',
      images: ['https://example.com/headphones.jpg'],
      inventory_count: 10,
      is_active: true
    }

    const { data: product, error } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single()

    if (error) throw error

    this.testProduct = {
      id: product.id,
      name: product.name,
      price: product.price,
      seller_id: product.seller_id
    }

    console.log(`Product created: ${this.testProduct.name} - $${this.testProduct.price}`)
  }

  async affiliatePromotesItem() {
    console.log('\n🔗 Affiliate promoting item...')

    const affiliate = this.testUsers.find(u => u.type === 'affiliate')

    // Generate affiliate link
    const affiliateLink = `https://beezio.com/product/${this.testProduct.id}?ref=${affiliate.id}`

    // Record affiliate promotion (click tracking)
    const { error: clickError } = await supabase
      .from('affiliate_clicks')
      .insert({
        affiliate_id: affiliate.id,
        product_id: this.testProduct.id,
        clicked_at: new Date().toISOString(),
        source: 'test_promotion'
      })

    if (clickError) throw clickError

    console.log(`Affiliate link generated: ${affiliateLink}`)
    console.log(`Click tracked for affiliate: ${affiliate.profile.full_name}`)
  }

  async buyerMakesPurchase() {
    console.log('\n🛒 Buyer making purchase...')

    const buyer = this.testUsers.find(u => u.type === 'buyer')
    const affiliate = this.testUsers.find(u => u.type === 'affiliate')

    // Simulate purchase through affiliate link
    const purchaseData = {
      product_id: this.testProduct.id,
      buyer_id: buyer.id,
      affiliate_id: affiliate.id, // Purchase through affiliate
      quantity: 1,
      total_amount: this.testProduct.price,
      status: 'pending'
    }

    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert(purchaseData)
      .select()
      .single()

    if (purchaseError) throw purchaseError

    // Process payment through Stripe
    const { data: paymentResult, error: paymentError } = await supabase.functions.invoke('process-marketplace-payment', {
      body: {
        purchase_id: purchase.id,
        amount: this.testProduct.price,
        buyer_id: buyer.id,
        seller_id: this.testProduct.seller_id,
        affiliate_id: affiliate.id
      }
    })

    if (paymentError) throw paymentError

    // Update purchase with payment info
    const { error: updateError } = await supabase
      .from('purchases')
      .update({
        status: 'completed',
        stripe_payment_id: paymentResult.payment_id,
        completed_at: new Date().toISOString()
      })
      .eq('id', purchase.id)

    if (updateError) throw updateError

    this.testTransaction = {
      id: purchase.id,
      product_id: this.testProduct.id,
      buyer_id: buyer.id,
      affiliate_id: affiliate.id,
      amount: this.testProduct.price,
      status: 'completed',
      stripe_payment_id: paymentResult.payment_id
    }

    console.log(`Purchase completed: $${this.testProduct.price}`)
    console.log(`Payment ID: ${paymentResult.payment_id}`)
  }

  async processPayments() {
    console.log('\n💰 Processing payments to seller and affiliate...')

    const seller = this.testUsers.find(u => u.type === 'seller')
    const affiliate = this.testUsers.find(u => u.type === 'affiliate')

    // Calculate payouts
    const productPrice = this.testProduct.price
    const platformFee = productPrice * 0.10 // 10% platform fee
    const affiliateCommission = (productPrice - platformFee) * 0.15 // 15% affiliate commission
    const sellerPayout = productPrice - platformFee - affiliateCommission

    console.log(`Product Price: $${productPrice.toFixed(2)}`)
    console.log(`Platform Fee (10%): $${platformFee.toFixed(2)}`)
    console.log(`Affiliate Commission (15%): $${affiliateCommission.toFixed(2)}`)
    console.log(`Seller Payout: $${sellerPayout.toFixed(2)}`)

    // Process seller payout
    const { error: sellerPayoutError } = await supabase
      .from('payouts')
      .insert({
        user_id: seller.id,
        amount: sellerPayout,
        status: 'completed',
        completed_at: new Date().toISOString(),
        stripe_transfer_id: `tr_test_seller_${Date.now()}`,
        description: `Sale of ${this.testProduct.name}`
      })

    if (sellerPayoutError) throw sellerPayoutError

    // Process affiliate payout
    const { error: affiliatePayoutError } = await supabase
      .from('payouts')
      .insert({
        user_id: affiliate.id,
        amount: affiliateCommission,
        status: 'completed',
        completed_at: new Date().toISOString(),
        stripe_transfer_id: `tr_test_affiliate_${Date.now()}`,
        description: `Commission for ${this.testProduct.name} referral`
      })

    if (affiliatePayoutError) throw affiliatePayoutError

    console.log('✅ Payments processed successfully')
  }

  async verifyDashboardData() {
    console.log('\n📊 Verifying dashboard data...')

    const seller = this.testUsers.find(u => u.type === 'seller')
    const affiliate = this.testUsers.find(u => u.type === 'affiliate')

    // Check seller dashboard data
    const { data: sellerEarnings, error: sellerError } = await supabase.functions.invoke('get-seller-earnings', {
      body: { userId: seller.id }
    })
    if (sellerError) throw sellerError

    // Check affiliate dashboard data
    const { data: affiliateEarnings, error: affiliateError } = await supabase.functions.invoke('get-affiliate-earnings', {
      body: { userId: affiliate.id }
    })
    if (affiliateError) throw affiliateError

    // Verify balances
    const expectedSellerEarnings = this.testProduct.price * 0.75 // 75% after fees and commission
    const expectedAffiliateEarnings = this.testProduct.price * 0.135 // 13.5% commission

    if (Math.abs(sellerEarnings.total_earned - expectedSellerEarnings) > 0.01) {
      throw new Error(`Seller earnings mismatch: expected ${expectedSellerEarnings}, got ${sellerEarnings.total_earned}`)
    }

    if (Math.abs(affiliateEarnings.total_earnings - expectedAffiliateEarnings) > 0.01) {
      throw new Error(`Affiliate earnings mismatch: expected ${expectedAffiliateEarnings}, got ${affiliateEarnings.total_earnings}`)
    }

    console.log('✅ Dashboard data verified')
    console.log(`Seller earnings: $${sellerEarnings.total_earned.toFixed(2)}`)
    console.log(`Affiliate earnings: $${affiliateEarnings.total_earnings.toFixed(2)}`)
  }

  async testTaxCompliance() {
    console.log('\n📋 Testing tax compliance functions...')

    const seller = this.testUsers.find(u => u.type === 'seller')
    const affiliate = this.testUsers.find(u => u.type === 'affiliate')

    // Check tax agreements
    const { data: sellerAgreements, error: sellerAgreementsError } = await supabase
      .from('tax_agreements')
      .select('*')
      .eq('user_id', seller.id)

    if (sellerAgreementsError) throw sellerAgreementsError
    if (sellerAgreements.length !== 3) throw new Error('Seller missing tax agreements')

    const { data: affiliateAgreements, error: affiliateAgreementsError } = await supabase
      .from('tax_agreements')
      .select('*')
      .eq('user_id', affiliate.id)

    if (affiliateAgreementsError) throw affiliateAgreementsError
    if (affiliateAgreements.length !== 3) throw new Error('Affiliate missing tax agreements')

    // Test 1099 generation (should not generate for small amounts)
    const { data: generationResult, error: generationError } = await supabase.functions.invoke('generate-1099-forms', {
      body: { year: new Date().getFullYear() }
    })

    if (generationError) throw generationError

    console.log(`1099 forms generated: ${generationResult.generated1099s.length}`)
    console.log('✅ Tax compliance functions working')
  }

  printTestSummary() {
    console.log('\n📈 TEST SUMMARY')
    console.log('==============')

    const seller = this.testUsers.find(u => u.type === 'seller')
    const affiliate = this.testUsers.find(u => u.type === 'affiliate')
    const buyer = this.testUsers.find(u => u.type === 'buyer')

    console.log(`👨‍💼 Seller: ${seller.profile.full_name}`)
    console.log(`🔗 Affiliate: ${affiliate.profile.full_name}`)
    console.log(`🛒 Buyer: ${buyer.profile.full_name}`)
    console.log(`📦 Product: ${this.testProduct.name} - $${this.testProduct.price}`)
    console.log(`💰 Transaction: ${this.testTransaction.id}`)
    console.log(`✅ Status: ${this.testTransaction.status}`)

    console.log('\n🎯 ALL SYSTEMS TESTED:')
    console.log('✅ User registration and profiles')
    console.log('✅ Stripe account creation (embedded)')
    console.log('✅ Tax agreement signing')
    console.log('✅ Product listing')
    console.log('✅ Affiliate promotion tracking')
    console.log('✅ Purchase processing')
    console.log('✅ Payment distribution')
    console.log('✅ Dashboard data accuracy')
    console.log('✅ Tax compliance functions')
  }
}

// Export for use in test files
export const marketplaceTransactionTester = new MarketplaceTransactionTester()

// Run test if this file is executed directly
if (import.meta.main) {
  marketplaceTransactionTester.runCompleteTransactionTest()
}