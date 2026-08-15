import type { Plugin } from 'vite';

function injectAfterImageBySrc(code: string, marker: string, jsx: string): string {
  let output = code;
  let cursor = 0;

  while (cursor < output.length) {
    const markerIndex = output.indexOf(marker, cursor);
    if (markerIndex < 0) break;

    const imgStart = output.lastIndexOf('<img', markerIndex);
    const imgEnd = output.indexOf('/>', markerIndex);
    if (imgStart < 0 || imgEnd < 0) {
      cursor = markerIndex + marker.length;
      continue;
    }

    // Never cross into another image tag when locating the marker's image.
    const nextImgBeforeMarker = output.indexOf('<img', imgStart + 4);
    if (nextImgBeforeMarker >= 0 && nextImgBeforeMarker < markerIndex) {
      cursor = markerIndex + marker.length;
      continue;
    }

    const insertAt = imgEnd + 2;
    const nearby = output.slice(insertAt, insertAt + 220);
    if (nearby.includes('<LovingNutritionImageOverlay')) {
      cursor = insertAt + 1;
      continue;
    }

    output = `${output.slice(0, insertAt)}\n${jsx}${output.slice(insertAt)}`;
    cursor = insertAt + jsx.length + 1;
  }

  return output;
}

export default function lovingNutritionBrandingPlugin(): Plugin {
  return {
    name: 'beezio-loving-nutrition-branding',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0];

      if (normalizedId.endsWith('/src/components/ProductCard.tsx')) {
        let code = source;
        if (!code.includes("from './LovingNutritionImageOverlay'")) {
          code = `import LovingNutritionImageOverlay from './LovingNutritionImageOverlay';\n${code}`;
        }
        code = injectAfterImageBySrc(
          code,
          'src={currentImage}',
          '              <LovingNutritionImageOverlay product={product as any} compact={compact} />\n'
        );
        return { code, map: null };
      }

      if (normalizedId.endsWith('/src/pages/ProductDetailPage.tsx')) {
        let code = source;
        if (!code.includes("from '../components/LovingNutritionImageOverlay'")) {
          code = `import LovingNutritionImageOverlay from '../components/LovingNutritionImageOverlay';\n${code}`;
        }
        code = injectAfterImageBySrc(
          code,
          'src={imageSrc}',
          '                    <LovingNutritionImageOverlay product={product as any} />\n'
        );
        code = injectAfterImageBySrc(
          code,
          'src={image}',
          '                <LovingNutritionImageOverlay product={product as any} thumbnail />\n'
        );
        return { code, map: null };
      }

      return null;
    },
  };
}
