// Example: $100 Item Fee Breakdown
console.log('💰 $100 ITEM FEE BREAKDOWN EXAMPLES\n');
console.log('Formula: Listing Price = (Seller + Affiliate + Stripe) + Beezio (10%)\n');

// Simulate the pricing calculation
function calculatePricing(sellerDesiredAmount, affiliateRate = 0, affiliateType = 'percentage') {
  const sellerAmount = sellerDesiredAmount;
  const affiliateAmount = affiliateType === 'percentage'
    ? sellerAmount * (affiliateRate / 100)
    : affiliateRate;

  const stripeBase = sellerAmount + affiliateAmount;
  const stripeFee = stripeBase * 0.03 + 0.60;
  const totalBeforePlatform = sellerAmount + affiliateAmount + stripeFee;
  const platformFee = totalBeforePlatform * 0.10;
  const listingPrice = totalBeforePlatform + platformFee;

  return {
    sellerAmount,
    affiliateAmount,
    stripeFee,
    platformFee,
    listingPrice,
    totalBeforePlatform
  };
}

console.log('🎯 EXAMPLE 1: $100 item, NO affiliate (direct sale)\n');

const example1 = calculatePricing(100, 0);
console.log(`Seller wants: $${example1.sellerAmount.toFixed(2)}`);
console.log(`Affiliate: $${example1.affiliateAmount.toFixed(2)} (no affiliate)`);
console.log(`Stripe fee: $${example1.stripeFee.toFixed(2)} (3% of $${(100).toFixed(2)} + $0.60)`);
console.log(`Subtotal before Beezio: $${example1.totalBeforePlatform.toFixed(2)}`);
console.log(`Beezio platform fee: $${example1.platformFee.toFixed(2)} (10% of $${example1.totalBeforePlatform.toFixed(2)})`);
console.log(`💳 Customer pays: $${example1.listingPrice.toFixed(2)}`);
console.log(`✅ Seller receives: $${example1.sellerAmount.toFixed(2)} (exactly what they wanted!)`);
console.log(`🏢 Beezio revenue: $${example1.platformFee.toFixed(2)}\n`);

console.log('🎯 EXAMPLE 2: $100 item, 20% affiliate commission\n');

const example2 = calculatePricing(100, 20);
console.log(`Seller wants: $${example2.sellerAmount.toFixed(2)}`);
console.log(`Affiliate: $${example2.affiliateAmount.toFixed(2)} (20% of $${example2.sellerAmount.toFixed(2)})`);
console.log(`Stripe fee: $${example2.stripeFee.toFixed(2)} (3% of $${(example2.sellerAmount + example2.affiliateAmount).toFixed(2)} + $0.60)`);
console.log(`Subtotal before Beezio: $${example2.totalBeforePlatform.toFixed(2)}`);
console.log(`Beezio platform fee: $${example2.platformFee.toFixed(2)} (10% of $${example2.totalBeforePlatform.toFixed(2)})`);
console.log(`💳 Customer pays: $${example2.listingPrice.toFixed(2)}`);
console.log(`✅ Seller receives: $${example2.sellerAmount.toFixed(2)} (exactly what they wanted!)`);
console.log(`🎁 Affiliate receives: $${example2.affiliateAmount.toFixed(2)}`);
console.log(`🏢 Beezio revenue: $${example2.platformFee.toFixed(2)}\n`);

console.log('🎯 EXAMPLE 3: $100 item, 30% affiliate commission\n');

const example3 = calculatePricing(100, 30);
console.log(`Seller wants: $${example3.sellerAmount.toFixed(2)}`);
console.log(`Affiliate: $${example3.affiliateAmount.toFixed(2)} (30% of $${example3.sellerAmount.toFixed(2)})`);
console.log(`Stripe fee: $${example3.stripeFee.toFixed(2)} (3% of $${(example3.sellerAmount + example3.affiliateAmount).toFixed(2)} + $0.60)`);
console.log(`Subtotal before Beezio: $${example3.totalBeforePlatform.toFixed(2)}`);
console.log(`Beezio platform fee: $${example3.platformFee.toFixed(2)} (10% of $${example3.totalBeforePlatform.toFixed(2)})`);
console.log(`💳 Customer pays: $${example3.listingPrice.toFixed(2)}`);
console.log(`✅ Seller receives: $${example3.sellerAmount.toFixed(2)} (exactly what they wanted!)`);
console.log(`🎁 Affiliate receives: $${example3.affiliateAmount.toFixed(2)}`);
console.log(`🏢 Beezio revenue: $${example3.platformFee.toFixed(2)}\n`);

console.log('📊 SUMMARY COMPARISON:\n');
console.log('| Affiliate Rate | Customer Pays | Seller Gets | Affiliate Gets | Beezio Gets |');
console.log('|---------------|---------------|-------------|----------------|-------------|');
console.log(`| 0% (direct)   | $${example1.listingPrice.toFixed(2)}     | $${example1.sellerAmount.toFixed(2)}      | $${example1.affiliateAmount.toFixed(2)}          | $${example1.platformFee.toFixed(2)}     |`);
console.log(`| 20%           | $${example2.listingPrice.toFixed(2)}     | $${example2.sellerAmount.toFixed(2)}      | $${example2.affiliateAmount.toFixed(2)}         | $${example2.platformFee.toFixed(2)}     |`);
console.log(`| 30%           | $${example3.listingPrice.toFixed(2)}     | $${example3.sellerAmount.toFixed(2)}      | $${example3.affiliateAmount.toFixed(2)}         | $${example3.platformFee.toFixed(2)}     |`);

console.log('\n🎉 KEY BENEFITS:');
console.log('✅ Seller ALWAYS gets exactly what they want ($100)');
console.log('✅ Beezio gets reasonable 10% platform fee');
console.log('✅ Customers pay competitive prices');
console.log('✅ Affiliates get their fair commission');
console.log('✅ Everyone wins with transparent pricing!');
