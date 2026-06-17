import { supabase } from '../lib/supabase';
import { normalizeProductImages } from './imageHelpers';

type ListingGuardrailAction = 'allow' | 'review' | 'block';

export type ListingGuardrailResult = {
  action: ListingGuardrailAction;
  hardReasons: string[];
  reviewReasons: string[];
  reputationScore: number;
  riskScore: number;
};

type ListingGuardrailInput = {
  sellerId: string;
  title: string;
  description: string;
  images: string[];
  tags: string[];
  categoryId?: string | null;
  categoryName?: string | null;
  sellerAsk: number;
  listingPrice: number;
  stockQuantity: number;
};

type ListingGuardrailContext = {
  peerMedianPrice?: number | null;
  peerSampleSize?: number;
  crossSellerImageMatches?: number;
  sameSellerImageMatches?: number;
  sellerReviewCount?: number;
  sellerAverageRating?: number;
  sellerProductCount?: number;
};

type ProductPeerRow = {
  seller_id?: string | null;
  images?: unknown;
  price?: number | null;
  seller_ask?: number | null;
  seller_amount?: number | null;
  seller_ask_price?: number | null;
};

const PROHIBITED_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'counterfeit or replica goods', pattern: /\b(counterfeit|replica|knockoff|fake designer|1:1 replica)\b/i },
  { label: 'weapons or weapon parts', pattern: /\b(ghost gun|unserialized firearm|switchblade|brass knuckles|ammo|ammunition|silencer)\b/i },
  { label: 'illegal drugs or controlled substances', pattern: /\b(cocaine|heroin|meth|fentanyl|steroids|psilocybin)\b/i },
  { label: 'stolen payment or identity goods', pattern: /\b(stolen card|fullz|fake id|forged id|ssn dump)\b/i },
  { label: 'pirated or stolen digital goods', pattern: /\b(pirated|stolen account|cracked software|license key dump)\b/i },
];

const SCAM_PATTERNS: Array<{ label: string; pattern: RegExp; hard?: boolean }> = [
  { label: 'off-platform payment request', pattern: /\b(wire transfer only|cashapp only|zelle only|venmo only|crypto only)\b/i, hard: true },
  { label: 'off-platform contact request', pattern: /\b(contact me on telegram|message me on whatsapp|dm before buying|pay me directly)\b/i, hard: true },
  { label: 'guaranteed income or unrealistic claim', pattern: /\b(guaranteed income|overnight wealth|get rich quick|100% guaranteed approval)\b/i },
  { label: 'wholesale or factory-direct claim', pattern: /\b(wholesale|wholesaler|factory direct|manufacturer direct|authorized distributor|direct importer)\b/i },
];

const LOW_EFFORT_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'placeholder text', pattern: /\b(lorem ipsum|test product|sample product|asdf|qwerty)\b/i },
  { label: 'generic filler wording', pattern: /\b(good quality product|best product ever|nice item)\b/i },
];

const CATEGORY_PRICE_FLOORS: Array<{ pattern: RegExp; min: number }> = [
  { pattern: /electronics|technology|automotive/i, min: 8 },
  { pattern: /fashion|apparel|beauty|pet|toys|games/i, min: 4 },
  { pattern: /home|garden|sports|outdoors|health|wellness/i, min: 5 },
];

const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase();

const extractImageSignature = (value: string) => {
  const clean = String(value || '').trim().split('?')[0].split('#')[0];
  const tail = clean.split('/').pop() || clean;
  return tail.toLowerCase();
};

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const getCategoryFloor = (categoryName?: string | null) => {
  const label = String(categoryName || '').trim();
  if (!label) return 3;
  const match = CATEGORY_PRICE_FLOORS.find((entry) => entry.pattern.test(label));
  return match?.min || 3;
};

const clamp = (value: number, minValue: number, maxValue: number) => Math.min(maxValue, Math.max(minValue, value));

export function evaluateListingGuardrailsSync(
  input: ListingGuardrailInput,
  context: ListingGuardrailContext = {}
): ListingGuardrailResult {
  const hardReasons: string[] = [];
  const reviewReasons: string[] = [];
  let riskScore = 0;

  const textHaystack = [input.title, input.description, ...input.tags].filter(Boolean).join(' ');
  const titleWords = String(input.title || '').trim().split(/\s+/).filter(Boolean);
  const descriptionLength = String(input.description || '').trim().length;
  const imageSignatures = input.images.map(extractImageSignature).filter(Boolean);
  const uniqueImageCount = new Set(imageSignatures).size;
  const categoryFloor = getCategoryFloor(input.categoryName);
  const reviewCount = Number(context.sellerReviewCount || 0);
  const avgRating = Number(context.sellerAverageRating || 0);
  const productCount = Number(context.sellerProductCount || 0);

  PROHIBITED_PATTERNS.forEach(({ label, pattern }) => {
    if (pattern.test(textHaystack)) hardReasons.push(`Listing appears to contain ${label}.`);
  });

  SCAM_PATTERNS.forEach(({ label, pattern, hard }) => {
    if (!pattern.test(textHaystack)) return;
    if (hard) {
      hardReasons.push(`Listing appears to include ${label}.`);
      return;
    }
    reviewReasons.push(`Listing includes ${label}.`);
    riskScore += /wholesale|factory/i.test(label) ? 3 : 4;
  });

  LOW_EFFORT_PATTERNS.forEach(({ label, pattern }) => {
    if (pattern.test(textHaystack)) {
      reviewReasons.push(`Listing contains ${label}.`);
      riskScore += 3;
    }
  });

  if (titleWords.length < 2) {
    reviewReasons.push('Title is too short to look trustworthy.');
    riskScore += 2;
  }

  if (descriptionLength < 80) {
    reviewReasons.push('Description is too thin for a launch-quality listing.');
    riskScore += 2;
  }

  if (input.images.length < 2) {
    reviewReasons.push('Listing needs more than one image to reduce scam risk.');
    riskScore += 1;
  }

  if (imageSignatures.length > uniqueImageCount) {
    reviewReasons.push('Listing repeats the same image file more than once.');
    riskScore += 2;
  }

  if ((context.crossSellerImageMatches || 0) > 0) {
    reviewReasons.push('Listing images closely match another seller listing and need review.');
    riskScore += 4;
  } else if ((context.sameSellerImageMatches || 0) > 1) {
    reviewReasons.push('Listing reuses images from other listings on the same seller account.');
    riskScore += 2;
  }

  if (input.listingPrice < 1 || input.sellerAsk < 0.5) {
    hardReasons.push('Listing price is unrealistically low for a legitimate product.');
  } else if (input.listingPrice < categoryFloor) {
    reviewReasons.push(`Listing price is below the expected floor for ${input.categoryName || 'this category'}.`);
    riskScore += 2;
  }

  if ((context.peerSampleSize || 0) >= 5 && context.peerMedianPrice && context.peerMedianPrice > 0) {
    if (input.listingPrice < context.peerMedianPrice * 0.2) {
      reviewReasons.push('Listing price is far below similar products already on Beezio.');
      riskScore += 3;
    } else if (input.listingPrice > context.peerMedianPrice * 5) {
      reviewReasons.push('Listing price is far above similar products already on Beezio.');
      riskScore += 3;
    }
  }

  if (/\b(wholesale|wholesaler|factory direct|manufacturer direct|authorized distributor)\b/i.test(textHaystack) && input.stockQuantity < 10) {
    reviewReasons.push('Wholesale-style claims do not match the current stock level.');
    riskScore += 3;
  }

  let reputationScore = 50;
  reputationScore += Math.min(productCount, 10);
  if (reviewCount === 0) {
    reputationScore -= 10;
  } else {
    reputationScore += Math.min(reviewCount, 20);
    reputationScore += Math.round((avgRating - 3.5) * 12);
  }
  reputationScore = clamp(reputationScore, 0, 100);

  if (reviewCount >= 3 && avgRating > 0 && avgRating < 2.5) {
    reviewReasons.push('Seller reputation score is low based on existing reviews.');
    riskScore += 4;
  } else if (reviewCount === 0 && productCount === 0) {
    reviewReasons.push('Brand new seller listings get manual review at launch.');
    riskScore += 1;
  }

  if (hardReasons.length > 0) {
    return { action: 'block', hardReasons, reviewReasons, reputationScore, riskScore };
  }

  const uniqueReviewReasons = [...new Set(reviewReasons)];
  const shouldReview = riskScore >= 4 || uniqueReviewReasons.length >= 2;
  return {
    action: shouldReview ? 'review' : 'allow',
    hardReasons,
    reviewReasons: uniqueReviewReasons,
    reputationScore,
    riskScore,
  };
}

export async function evaluateListingGuardrails(input: ListingGuardrailInput): Promise<ListingGuardrailResult> {
  const [sellerReviewsResult, sellerProductsResult, peerProductsResult] = await Promise.allSettled([
    supabase.from('seller_reviews').select('rating').eq('seller_id', input.sellerId),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('seller_id', input.sellerId),
    (() => {
      const query = supabase
        .from('products')
        .select('seller_id,images,price,seller_ask,seller_amount,seller_ask_price,category,category_id,status,is_active,is_promotable')
        .or('is_active.eq.true,is_promotable.eq.true,status.eq.active')
        .limit(120);

      if (input.categoryId) return query.eq('category_id', input.categoryId);
      if (input.categoryName) return query.ilike('category', input.categoryName);
      return query;
    })(),
  ]);

  const sellerReviewRows = sellerReviewsResult.status === 'fulfilled' ? sellerReviewsResult.value.data || [] : [];
  const sellerReviewValues = sellerReviewRows
    .map((row: any) => Number(row?.rating || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const sellerAverageRating = sellerReviewValues.length
    ? sellerReviewValues.reduce((sum, value) => sum + value, 0) / sellerReviewValues.length
    : 0;

  const sellerProductCount = sellerProductsResult.status === 'fulfilled'
    ? Number(sellerProductsResult.value.count || 0)
    : 0;

  const peerRows: ProductPeerRow[] = peerProductsResult.status === 'fulfilled'
    ? ((peerProductsResult.value.data as ProductPeerRow[]) || [])
    : [];

  const peerMedianPrice = median(
    peerRows
      .map((row) => {
        const candidates = [row.price, row.seller_ask, row.seller_amount, row.seller_ask_price]
          .map((value) => Number(value || 0))
          .filter((value) => Number.isFinite(value) && value > 0);
        return candidates[0] || 0;
      })
      .filter((value) => value > 0)
  );

  const listingSignatures = new Set(input.images.map(extractImageSignature).filter(Boolean));
  let crossSellerImageMatches = 0;
  let sameSellerImageMatches = 0;

  peerRows.forEach((row) => {
    const peerSignatures = new Set(normalizeProductImages(row.images).map(extractImageSignature).filter(Boolean));
    const hasMatch = [...listingSignatures].some((signature) => peerSignatures.has(signature));
    if (!hasMatch) return;
    if (String(row.seller_id || '').trim() === input.sellerId) {
      sameSellerImageMatches += 1;
    } else {
      crossSellerImageMatches += 1;
    }
  });

  return evaluateListingGuardrailsSync(input, {
    peerMedianPrice,
    peerSampleSize: peerRows.length,
    crossSellerImageMatches,
    sameSellerImageMatches,
    sellerReviewCount: sellerReviewValues.length,
    sellerAverageRating,
    sellerProductCount,
  });
}