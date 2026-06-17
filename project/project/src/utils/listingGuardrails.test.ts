import { describe, expect, it } from 'vitest';
import { evaluateListingGuardrailsSync } from './listingGuardrails';

describe('listingGuardrails', () => {
  it('blocks prohibited listings', () => {
    const result = evaluateListingGuardrailsSync({
      sellerId: 'seller-1',
      title: 'Replica designer bag',
      description: 'Best replica available',
      images: ['https://example.com/a.jpg'],
      tags: [],
      categoryName: 'Fashion',
      categoryId: 'fashion',
      sellerAsk: 50,
      listingPrice: 80,
      stockQuantity: 2,
    });

    expect(result.action).toBe('block');
    expect(result.hardReasons[0]).toContain('counterfeit');
  });

  it('sends suspicious listings to review', () => {
    const result = evaluateListingGuardrailsSync(
      {
        sellerId: 'seller-1',
        title: 'Factory direct wholesale earbuds',
        description: 'Short desc',
        images: ['https://example.com/a.jpg'],
        tags: ['wholesale'],
        categoryName: 'Electronics',
        categoryId: 'electronics',
        sellerAsk: 2,
        listingPrice: 3,
        stockQuantity: 1,
      },
      {
        peerMedianPrice: 30,
        peerSampleSize: 12,
        sellerReviewCount: 0,
        sellerAverageRating: 0,
        sellerProductCount: 0,
        crossSellerImageMatches: 1,
      }
    );

    expect(result.action).toBe('review');
    expect(result.reviewReasons.join(' ')).toContain('images closely match');
  });

  it('allows normal listings with healthy signals', () => {
    const result = evaluateListingGuardrailsSync(
      {
        sellerId: 'seller-1',
        title: 'Stainless Steel Water Bottle',
        description: 'Double-wall insulated stainless steel bottle with leak resistant lid and detailed care instructions.',
        images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
        tags: ['hydration', 'outdoors'],
        categoryName: 'Sports & Outdoors',
        categoryId: 'sports',
        sellerAsk: 14,
        listingPrice: 22,
        stockQuantity: 30,
      },
      {
        peerMedianPrice: 20,
        peerSampleSize: 15,
        sellerReviewCount: 8,
        sellerAverageRating: 4.6,
        sellerProductCount: 6,
        crossSellerImageMatches: 0,
      }
    );

    expect(result.action).toBe('allow');
  });
});