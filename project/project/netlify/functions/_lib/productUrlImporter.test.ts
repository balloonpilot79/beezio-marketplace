import { describe, expect, it } from 'vitest';
import { assertSafeProductUrl, parseProductHtml } from './productUrlImporter';

describe('admin product URL importer', () => {
  it('blocks private and loopback destinations', async () => {
    await expect(assertSafeProductUrl('http://127.0.0.1/product')).rejects.toThrow(/private/i);
    await expect(assertSafeProductUrl('https://supplier.example/item', async () => [{ address: '10.0.0.8', family: 4 }]))
      .rejects.toThrow(/private/i);
  });

  it('extracts wholesale pricing, images, and structured variants for review', () => {
    const preview = parseProductHtml(`
      <html><head>
        <script type="application/ld+json">
          {
            "@type": "Product",
            "name": "Daily Wellness Blend",
            "description": "A sample supplement product.",
            "brand": { "name": "Loving Nutrition" },
            "sku": "LN-BASE",
            "image": ["/images/front.png", "/images/back.png"],
            "offers": { "price": "12.50", "priceCurrency": "USD" },
            "hasVariant": [
              {
                "@type": "Product",
                "name": "30 count",
                "sku": "LN-30",
                "image": "/images/30.png",
                "offers": { "price": "11.25", "availability": "https://schema.org/InStock" }
              },
              {
                "@type": "Product",
                "name": "60 count",
                "sku": "LN-60",
                "image": "/images/60.png",
                "offers": { "price": "19.75", "availability": "https://schema.org/InStock" }
              }
            ]
          }
        </script>
      </head></html>
    `, 'https://supplier.example/products/wellness');

    expect(preview.title).toBe('Daily Wellness Blend');
    expect(preview.wholesalePrice).toBe(12.5);
    expect(preview.images).toContain('https://supplier.example/images/front.png');
    expect(preview.variants.map((variant) => variant.sku)).toEqual(expect.arrayContaining(['LN-30', 'LN-60']));
    expect(preview.variants.find((variant) => variant.sku === 'LN-60')?.wholesalePrice).toBe(19.75);
    expect(preview.warnings.some((warning) => /supplement/i.test(warning))).toBe(true);
  });
});
