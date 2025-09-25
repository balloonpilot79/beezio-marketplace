import { supabase } from '../lib/supabase'

export const testTaxComplianceSystem = async () => {
  console.log('🧪 Testing Tax Compliance System...')

  try {
    // Test 1: Check if tax agreement tables exist
    console.log('1. Checking tax agreement tables...')
    const { error: taxError } = await supabase
      .from('tax_agreements')
      .select('*')
      .limit(1)

    if (taxError) {
      console.error('❌ Tax agreements table error:', taxError)
      return false
    }
    console.log('✅ Tax agreements table accessible')

    // Test 2: Check if 1099 reports table exists
    console.log('2. Checking 1099 reports table...')
    const { error: reportsError } = await supabase
      .from('tax_1099_reports')
      .select('*')
      .limit(1)

    if (reportsError) {
      console.error('❌ 1099 reports table error:', reportsError)
      return false
    }
    console.log('✅ 1099 reports table accessible')

    // Test 3: Check if embedded Stripe account creation function exists
    console.log('3. Testing embedded Stripe account creation function...')
    const { error: accountError } = await supabase.functions.invoke('create-embedded-stripe-account', {
      body: { test: true }
    })

    if (accountError && !accountError.message.includes('test')) {
      console.error('❌ Embedded Stripe account function error:', accountError)
      return false
    }
    console.log('✅ Embedded Stripe account function accessible')

    // Test 4: Check if 1099 generation function exists
    console.log('4. Testing 1099 generation function...')
    const { error: generationError } = await supabase.functions.invoke('generate-1099-forms', {
      body: { year: 2023 }
    })

    if (generationError) {
      console.error('❌ 1099 generation function error:', generationError)
      return false
    }
    console.log('✅ 1099 generation function accessible')

    console.log('🎉 All tax compliance system tests passed!')
    return true

  } catch (error) {
    console.error('❌ Test failed with error:', error)
    return false
  }
}

// Run test if this file is executed directly
// Note: This is a utility function that can be imported and called from other modules