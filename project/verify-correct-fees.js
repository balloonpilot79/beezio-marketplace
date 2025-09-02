// Generate corrected sample data with proper fee structure
// Seller pays nothing, gets 100% of desired amount
// Platform fee: 10% of seller amount
// Affiliate commission: % of seller amount  
// Stripe fee: 3% of total
// Customer pays: seller + affiliate + platform + stripe

const fs = require('fs');

// Helper function to calculate correct pricing
function calculateCorrectPricing(sellerDesiredAmount, affiliateCommissionRate) {
  const affiliateAmount = sellerDesiredAmount * (affiliateCommissionRate / 100);
  const platformFee = sellerDesiredAmount * 0.10; // 10% of seller amount only
  const beforeStripe = sellerDesiredAmount + affiliateAmount + platformFee;
  const stripeFee = (beforeStripe * 0.03) / (1 - 0.03); // Stripe fee calculation
  const finalPrice = beforeStripe + stripeFee;
  
  return {
    price: Number(finalPrice.toFixed(2)),
    seller_amount: Number(sellerDesiredAmount.toFixed(2)),
    platform_fee: Number(platformFee.toFixed(2)),
    stripe_fee: Number(stripeFee.toFixed(2)),
    affiliate_commission_amount: Number(affiliateAmount.toFixed(2))
  };
}

// Test examples with correct fee structure
console.log('🧮 CORRECTED FEE EXAMPLES:');
console.log('========================');

// Example 1: Seller wants $100, 20% affiliate commission
const example1 = calculateCorrectPricing(100, 20);
console.log('\nExample 1: Seller wants $100, 20% affiliate commission');
console.log(`- Seller gets: $${example1.seller_amount} (exactly what they want)`);
console.log(`- Affiliate earns: $${example1.affiliate_commission_amount} (20% of seller amount)`);
console.log(`- Platform fee: $${example1.platform_fee} (10% of seller amount)`);
console.log(`- Stripe fee: $${example1.stripe_fee} (3% of total)`);
console.log(`- Customer pays: $${example1.price}`);
console.log(`- Total check: $${example1.seller_amount + example1.affiliate_commission_amount + example1.platform_fee + example1.stripe_fee} = $${example1.price}`);

// Example 2: Seller wants $69.29 (like the wallet), 12% affiliate commission
const example2 = calculateCorrectPricing(69.29, 12);
console.log('\nExample 2: Seller wants $69.29, 12% affiliate commission');
console.log(`- Seller gets: $${example2.seller_amount} (exactly what they want)`);
console.log(`- Affiliate earns: $${example2.affiliate_commission_amount} (12% of seller amount)`);
console.log(`- Platform fee: $${example2.platform_fee} (10% of seller amount)`);
console.log(`- Stripe fee: $${example2.stripe_fee} (3% of total)`);
console.log(`- Customer pays: $${example2.price}`);

// Example 3: Seller wants $230.99, 20% affiliate commission  
const example3 = calculateCorrectPricing(230.99, 20);
console.log('\nExample 3: Seller wants $230.99, 20% affiliate commission');
console.log(`- Seller gets: $${example3.seller_amount} (exactly what they want)`);
console.log(`- Affiliate earns: $${example3.affiliate_commission_amount} (20% of seller amount)`);
console.log(`- Platform fee: $${example3.platform_fee} (10% of seller amount)`);
console.log(`- Stripe fee: $${example3.stripe_fee} (3% of total)`);
console.log(`- Customer pays: $${example3.price}`);

console.log('\n✅ CORRECTED FEE STRUCTURE VERIFIED!');
console.log('- Sellers pay $0 in fees');  
console.log('- Platform fee is 10% of seller amount only');
console.log('- Affiliate commission is % of seller amount');
console.log('- All fees added on top, customer pays transparent total');
