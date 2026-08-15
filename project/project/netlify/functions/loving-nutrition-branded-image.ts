import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';

const BRAND_LOGO_URL = 'https://beezio.co/loving-nutrition-logo.png';
const VIEWBOX = 2048;

const text = (value: unknown) => String(value ?? '').trim();

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

type Placement = {
  panelX: number;
  panelY: number;
  panelW: number;
  panelH: number;
  logoX: number;
  logoY: number;
  logoW: number;
  logoH: number;
  radius: number;
};

function placementFor(title: string, category: string): Placement {
  const key = `${title} ${category}`.toLowerCase();

  // Supliful mockups are centered 2048x2048 product renders. These presets keep
  // the brand artwork physically inside the package/label face instead of
  // floating over the product photograph.
  if (/(coffee|tea|matcha)/i.test(key)) {
    return { panelX: 700, panelY: 650, panelW: 648, panelH: 430, logoX: 812, logoY: 685, logoW: 424, logoH: 350, radius: 28 };
  }
  if (/(soap|bar|luffa)/i.test(key)) {
    return { panelX: 720, panelY: 715, panelW: 608, panelH: 400, logoX: 820, logoY: 745, logoW: 408, logoH: 332, radius: 24 };
  }
  if (/(strip|tin)/i.test(key)) {
    return { panelX: 690, panelY: 690, panelW: 668, panelH: 420, logoX: 804, logoY: 720, logoW: 440, logoH: 350, radius: 28 };
  }
  if (/(cream|gel|mud|scrub|butter|balm|serum|lotion|body care|facial care|cosmetic)/i.test(key)) {
    return { panelX: 735, panelY: 690, panelW: 578, panelH: 410, logoX: 830, logoY: 720, logoW: 388, logoH: 340, radius: 30 };
  }
  if (/(powder|protein|creatine|electrolyte|pre-workout|gummy|gummies)/i.test(key)) {
    return { panelX: 690, panelY: 635, panelW: 668, panelH: 450, logoX: 800, logoY: 670, logoW: 448, logoH: 360, radius: 30 };
  }

  // Capsules, tablets, softgels and the majority of supplement bottles.
  return { panelX: 750, panelY: 655, panelW: 548, panelH: 405, logoX: 838, logoY: 685, logoW: 372, logoH: 335, radius: 32 };
}

function mimeFor(response: Response, fallback: string): string {
  const header = text(response.headers.get('content-type')).split(';')[0];
  return header.startsWith('image/') ? header : fallback;
}

async function fetchAsDataUrl(url: string, fallbackMime: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Beezio-LovingNutrition-BrandRenderer/1.0',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  });
  if (!response.ok) throw new Error(`Image fetch failed (${response.status}) for ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 128) throw new Error(`Image fetch returned an empty payload for ${url}`);
  return `data:${mimeFor(response, fallbackMime)};base64,${bytes.toString('base64')}`;
}

function rawImagesFrom(product: any): string[] {
  const info = product?.supplier_info && typeof product.supplier_info === 'object'
    ? product.supplier_info
    : {};
  const stored = Array.isArray(info?.raw_supplier_images) ? info.raw_supplier_images : [];
  const current = Array.isArray(product?.images) ? product.images : [];
  return Array.from(new Set([
    ...stored,
    info?.raw_primary_image_url,
    ...current,
  ].map(text).filter((url) => /^https:\/\//i.test(url) && !/loving-nutrition-branded-image/i.test(url))));
}

const handler: Handler = async (event) => {
  try {
    const productId = text(event.queryStringParameters?.id);
    const imageIndex = Math.max(0, Math.min(1, Number(event.queryStringParameters?.image || 0) || 0));
    if (!productId) return { statusCode: 400, body: 'Missing product id' };

    const supabase = createSupabaseAdmin();
    const { data: product, error } = await supabase
      .from('products')
      .select('id,title,category,source_platform,images,primary_image_url,supplier_info')
      .eq('id', productId)
      .eq('source_platform', 'supliful')
      .maybeSingle();

    if (error || !product) {
      return { statusCode: 404, body: 'Loving Nutrition product not found' };
    }

    const rawImages = rawImagesFrom(product);
    const rawUrl = rawImages[imageIndex] || rawImages[0];
    if (!rawUrl) return { statusCode: 404, body: 'Raw Supliful product image unavailable' };

    const [rawDataUrl, logoDataUrl] = await Promise.all([
      fetchAsDataUrl(rawUrl, 'image/jpeg'),
      fetchAsDataUrl(BRAND_LOGO_URL, 'image/png'),
    ]);

    const placement = placementFor(text(product.title), text(product.category));
    const title = xmlEscape(text(product.title) || 'Loving Nutrition');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${VIEWBOX}" height="${VIEWBOX}" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" role="img" aria-label="${title} by Loving Nutrition">
  <image href="${rawDataUrl}" x="0" y="0" width="${VIEWBOX}" height="${VIEWBOX}" preserveAspectRatio="xMidYMid slice"/>
  <rect x="${placement.panelX}" y="${placement.panelY}" width="${placement.panelW}" height="${placement.panelH}" rx="${placement.radius}" fill="#fffdf8" fill-opacity="0.985" stroke="#c8a84b" stroke-width="7"/>
  <image href="${logoDataUrl}" x="${placement.logoX}" y="${placement.logoY}" width="${placement.logoW}" height="${placement.logoH}" preserveAspectRatio="xMidYMid meet"/>
</svg>`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff',
      },
      body: svg,
    };
  } catch (error) {
    console.error('[loving-nutrition-branded-image]', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: error instanceof Error ? error.message : String(error),
    };
  }
};

export { handler };
