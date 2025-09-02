// Comparison of OLD vs NEW fee structures
console.log('🔄 FEE STRUCTURE COMPARISON: OLD vs NEW\n');

// Test case: $50 seller, 20% affiliate
const sellerAmount = 50;
const affiliateRate = 20;
const affiliateAmount = sellerAmount * (affiliateRate / 100); // $10

console.log('Test Case: $50 seller + 20% affiliate commission');
console.log('=====================================\n');

// OLD Formula (what we had before)
console.log('❌ OLD FORMULA (Incorrect):');
console.log('   Beezio gets EQUAL SHARE of (seller + affiliate + stripe)');

const oldStripeBase = sellerAmount + affiliateAmount; // $60
const oldStripeFee = oldStripeBase * 0.03 + 0.60; // $2.40
const oldCostsTotal = sellerAmount + affiliateAmount + oldStripeFee; // $62.40
const oldPlatformFee = oldCostsTotal; // $62.40 (Beezio gets equal share)
const oldTotalPrice = oldCostsTotal + oldPlatformFee; // $124.80

console.log(`   Seller: $${sellerAmount.toFixed(2)}`);
console.log(`   Affiliate: $${affiliateAmount.toFixed(2)}`);
console.log(`   Stripe: $${oldStripeFee.toFixed(2)}`);
console.log(`   Beezio: $${oldPlatformFee.toFixed(2)} (EQUAL SHARE)`);
console.log(`   Customer pays: $${oldTotalPrice.toFixed(2)}`);
console.log(`   ❌ Beezio gets: ${(oldPlatformFee/oldTotalPrice*100).toFixed(1)}% of total\n`);

// NEW Formula (what you requested)
console.log('✅ NEW FORMULA (Correct):');
console.log('   Beezio gets 10% of (seller + affiliate + stripe)');

const newStripeBase = sellerAmount + affiliateAmount; // $60
const newStripeFee = newStripeBase * 0.03 + 0.60; // $2.40
const newTotalBeforePlatform = sellerAmount + affiliateAmount + newStripeFee; // $62.40
const newPlatformFee = newTotalBeforePlatform * 0.10; // $6.24 (Beezio gets 10%)
const newTotalPrice = newTotalBeforePlatform + newPlatformFee; // $68.64

console.log(`   Seller: $${sellerAmount.toFixed(2)}`);
console.log(`   Affiliate: $${affiliateAmount.toFixed(2)}`);
console.log(`   Stripe: $${newStripeFee.toFixed(2)}`);
console.log(`   Beezio: $${newPlatformFee.toFixed(2)} (10% of subtotal)`);
console.log(`   Customer pays: $${newTotalPrice.toFixed(2)}`);
console.log(`   ✅ Beezio gets: ${(newPlatformFee/newTotalPrice*100).toFixed(1)}% of total\n`);

// Summary
console.log('📊 SUMMARY:');
console.log(`   Old formula: Customer pays $${oldTotalPrice.toFixed(2)}`);
console.log(`   New formula: Customer pays $${newTotalPrice.toFixed(2)}`);
console.log(`   Difference: $${(oldTotalPrice - newTotalPrice).toFixed(2)} cheaper for customers`);
console.log(`   Beezio revenue: Old $${oldPlatformFee.toFixed(2)} vs New $${newPlatformFee.toFixed(2)}`);
console.log(`   ✅ New formula is ${(oldPlatformFee/newPlatformFee).toFixed(1)}x more reasonable!`);
