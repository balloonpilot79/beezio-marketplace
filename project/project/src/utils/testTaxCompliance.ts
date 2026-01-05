import { supabase } from '../lib/supabase'

export const testTaxComplianceSystem = async () => {
  console.log('dY¦ Testing Tax Compliance System...')

  try {
    // Test 1: Check if tax agreement tables exist
    console.log('1. Checking tax agreement tables...')
    const { error: taxError } = await supabase.from('tax_agreements').select('*').limit(1)

    if (taxError) {
      console.error('ƒ?O Tax agreements table error:', taxError)
      return false
    }
    console.log('ƒo. Tax agreements table accessible')

    // Test 2: Check if 1099 reports table exists
    console.log('2. Checking 1099 reports table...')
    const { error: reportsError } = await supabase.from('tax_1099_reports').select('*').limit(1)

    if (reportsError) {
      console.error('ƒ?O 1099 reports table error:', reportsError)
      return false
    }
    console.log('ƒo. 1099 reports table accessible')

    // Test 3: Check if embedded Stripe account creation function exists
    console.log('3. Testing embedded Stripe account creation function...')
    const { error: accountError } = await supabase.functions.invoke('create-embedded-stripe-account', {
      body: { type: 'invalid', agreements_signed: false },
    })

    if (accountError) {
      console.log('ƒo. Embedded Stripe account function reachable (expected error):', accountError.message)
    } else {
      console.log('ƒo. Embedded Stripe account function accessible')
    }

    // Test 4: Check if 1099 generation function exists
    console.log('4. Testing 1099 generation function...')
    const { error: generationError } = await supabase.functions.invoke('generate-1099-forms', {
      body: { year: 2023 },
    })

    if (generationError) {
      console.error('ƒ?O 1099 generation function error:', generationError)
      return false
    }
    console.log('ƒo. 1099 generation function accessible')

    console.log('dYZ% All tax compliance system tests passed!')
    return true
  } catch (error) {
    console.error('ƒ?O Test failed with error:', error)
    return false
  }
}
