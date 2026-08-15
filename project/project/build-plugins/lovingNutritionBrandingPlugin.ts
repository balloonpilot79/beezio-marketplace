import type { Plugin, ResolvedConfig } from 'vite';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function injectAfterMatchingImages(
  code: string,
  srcExpression: string,
  jsx: string,
): { code: string; count: number } {
  const src = escapeRegExp(srcExpression);
  // Match one self-closing <img> tag containing the requested src expression.
  // The tempered sections prevent the match from crossing into a second image tag.
  const pattern = new RegExp(
    `(<img\\b(?:(?!<img\\b)[\\s\\S])*?src=\\{${src}\\}(?:(?!<img\\b)[\\s\\S])*?/>)`,
    'g',
  );

  let count = 0;
  const next = code.replace(pattern, (imageTag) => {
    count += 1;
    return `${imageTag}\n${jsx}`;
  });

  return { code: next, count };
}

export default function lovingNutritionBrandingPlugin(): Plugin {
  let config: ResolvedConfig | null = null;
  let productCardInjections = 0;
  let productDetailInjections = 0;

  return {
    name: 'beezio-loving-nutrition-branding',
    enforce: 'pre',

    configResolved(resolved) {
      config = resolved;
    },

    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0];

      if (normalizedId.endsWith('/src/components/ProductCard.tsx')) {
        let code = source;
        if (!code.includes("from './LovingNutritionImageOverlay'")) {
          code = `import LovingNutritionImageOverlay from './LovingNutritionImageOverlay';\n${code}`;
        }

        const injected = injectAfterMatchingImages(
          code,
          'currentImage',
          '              <LovingNutritionImageOverlay product={product as any} compact={compact} />',
        );
        productCardInjections += injected.count;
        console.log(`[loving-nutrition-branding] ProductCard images branded: ${injected.count}`);
        return { code: injected.code, map: null };
      }

      if (normalizedId.endsWith('/src/pages/ProductDetailPage.tsx')) {
        let code = source;
        if (!code.includes("from '../components/LovingNutritionImageOverlay'")) {
          code = `import LovingNutritionImageOverlay from '../components/LovingNutritionImageOverlay';\n${code}`;
        }

        const primary = injectAfterMatchingImages(
          code,
          'imageSrc',
          '                    <LovingNutritionImageOverlay product={product as any} />',
        );
        const thumbnails = injectAfterMatchingImages(
          primary.code,
          'image',
          '                <LovingNutritionImageOverlay product={product as any} thumbnail />',
        );
        productDetailInjections += primary.count + thumbnails.count;
        console.log(
          `[loving-nutrition-branding] ProductDetail images branded: ${primary.count + thumbnails.count}`,
        );
        return { code: thumbnails.code, map: null };
      }

      return null;
    },

    buildEnd(error) {
      if (error || config?.command !== 'build') return;
      if (productCardInjections < 1) {
        this.error('Loving Nutrition branding guard: no ProductCard image was branded.');
      }
      if (productDetailInjections < 1) {
        this.error('Loving Nutrition branding guard: no ProductDetail image was branded.');
      }
      console.log(
        `[loving-nutrition-branding] build guard passed (${productCardInjections} card images, ${productDetailInjections} detail images)`,
      );
    },
  };
}
