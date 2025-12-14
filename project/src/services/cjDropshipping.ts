// CJ Dropshipping API Integration Service
// Handles product import, order creation, and tracking synchronization

import { DEFAULT_PAYOUT_SETTINGS, PLATFORM_FEE_PERCENT } from '../config/beezioConfig';
import { calculateFinalPrice, computePayoutBreakdown } from '../utils/pricingEngine';

const CJ_API_BASE_URL = import.meta.env.VITE_CJ_API_BASE_URL || 'https://developers.cjdropshipping.com/api2.0/v1/';
const CJ_API_KEY = import.meta.env.VITE_CJ_API_KEY;

interface CJApiResponse<T> {
  code: number;
  result: boolean;
  message: string;
  data: T;
}

interface CJProduct {
  pid: string;
  productNameEn: string;
  productNameCn?: string;
  productSku: string;
  productImage: string;
  productImageList?: string[];
  categoryId: string;
  categoryName: string;
  sellPrice: number;
  variants?: CJVariant[];
  description?: string;
  productWeight?: number;
  packingWeight?: number;
  productType?: string;
}

interface CJVariant {
  vid: string;
  variantSku: string;
  variantNameEn: string;
  variantImage?: string;
  variantSellPrice: number;
  variantStock: number;
}

interface CJOrder {
  orderNumber: string;
  products: Array<{
    pid: string;
    vid?: string;
    quantity: number;
  }>;
  shippingAddress: {
    firstName: string;
    lastName: string;
    address: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone: string;
    email: string;
  };
  logisticName?: string;
}

interface CJOrderResponse {
  orderNumber: string;
  cjOrderId: string;
  totalAmount: number;
  status: string;
}

interface CJTrackingInfo {
  orderNumber: string;
  cjOrderId: string;
  trackingNumber: string;
  logisticName: string;
  trackingUrl: string;
  status: string;
}

/**
 * Make authenticated request to CJ API via Netlify proxy to avoid CORS
 */
async function cjRequest<T>(endpoint: string, data?: any, method: 'GET' | 'POST' = 'POST'): Promise<CJApiResponse<T>> {
  const controller = new AbortController();
  const timeoutMs = 25000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  // Use Netlify function proxy to avoid CORS issues
  let response: Response;
  try {
    response = await fetch('/.netlify/functions/cj-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint,
        body: data,
        method  // Pass HTTP method to proxy
      }),
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(`CJ API request timed out after ${timeoutMs / 1000}s (${endpoint})`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `CJ API request failed: ${response.status}`);
  }

  const result = await response.json();
  
  if (!result.result) {
    throw new Error(`CJ API error: ${result.message}`);
  }

  return result;
}

/**
 * Get product list from CJ catalog
 * @param pageNum Page number (default: 1)
 * @param pageSize Items per page (default: 50, max: 100)
 * @param categoryId Filter by category (optional)
 */
export async function getCJProducts(
  pageNum: number = 1,
  pageSize: number = 50,
  categoryId?: string
): Promise<{ products: CJProduct[]; total: number }> {
  console.log('🟡 getCJProducts called with:', { pageNum, pageSize, categoryId });
  
  const data: any = {
    page: pageNum,
    size: pageSize,
  };

  if (categoryId) {
    data.categoryId = categoryId;
  }

  // CJ API uses /product/listV2 (GET with query params)
  const response = await cjRequest<any>('product/listV2', data, 'GET');
  
  console.log('🟡 getCJProducts raw response:', response);
  
  // ListV2 returns data in nested structure: data.content[0].productList
  const content = response.data?.content?.[0] || {};
  const rawProducts = content.productList || [];
  
  // Map CJ API fields to our interface
  const products = rawProducts.map((p: any) => ({
    pid: p.id,
    productNameEn: p.nameEn,
    productSku: p.sku,
    productImage: p.bigImage,
    categoryName: p.threeCategoryName || p.twoCategoryName || p.oneCategoryName || 'Uncategorized',
    sellPrice: parseFloat(String(p.sellPrice).split('--')[0].trim()),
  }));
  
  console.log('🟡 getCJProducts parsed:', { 
    productsCount: products.length, 
    total: response.data?.totalRecords,
    firstProduct: products[0] 
  });
  
  return {
    products: products,
    total: response.data?.totalRecords || 0,
  };
}

/**
 * Get detailed product information including variants
 */
export async function getCJProductDetail(pid: string): Promise<CJProduct> {
  const response = await cjRequest<CJProduct>('product/query', { pid }, 'GET');
  return response.data;
}

/**
 * Get product categories from CJ
 */
export async function getCJCategories(): Promise<Array<{ id: string; name: string; parentId?: string }>> {
  console.log('🟡 getCJCategories called');
  
  // CJ API uses /product/getCategory (GET)
  const response = await cjRequest<any>('product/getCategory', {}, 'GET');
  
  console.log('🟡 getCJCategories raw response:', response);
  
  // Response structure: data is array of { categoryFirstName, categoryFirstList: [...] }
  const categories: Array<{ id: string; name: string; parentId?: string }> = [];
  
  if (Array.isArray(response.data)) {
    response.data.forEach((firstLevel: any) => {
      firstLevel.categoryFirstList?.forEach((secondLevel: any) => {
        secondLevel.categorySecondList?.forEach((thirdLevel: any) => {
          categories.push({
            id: thirdLevel.categoryId,
            name: `${firstLevel.categoryFirstName} / ${secondLevel.categorySecondName} / ${thirdLevel.categoryName}`,
            parentId: secondLevel.categorySecondName,
          });
        });
      });
    });
  }
  
  return categories;
}

/**
 * Create order in CJ system after Stripe payment clears
 */
export async function createCJOrder(orderData: CJOrder): Promise<CJOrderResponse> {
  const response = await cjRequest<CJOrderResponse>('shopping/order/createOrder', orderData);
  return response.data;
}

/**
 * Get order status and tracking information
 */
export async function getCJOrderTracking(orderNumber: string): Promise<CJTrackingInfo> {
  const response = await cjRequest<CJTrackingInfo>('shopping/order/query', { orderNumber });
  return response.data;
}

/**
 * Sync inventory for a specific product
 */
export async function getCJProductInventory(pid: string, vid?: string): Promise<number> {
  const data: any = { pid };
  if (vid) {
    data.vid = vid;
  }

  const response = await cjRequest<{ stock: number }>('product/inventory/query', data);
  return response.data.stock || 0;
}

/**
 * Calculate total cost for Beezio including:
 * - CJ product cost
 * - Your desired markup
 * - Affiliate commission (if applicable)
 * - Recruiter commission (5% if affiliate was referred)
 * - Beezio platform fee (10%)
 * - Stripe processing fee (2.9% + $0.30)
 */
export function calculateBeezioPrice(
  cjCost: number,
  markupPercent: number = 100, // Your markup (e.g., 100% = double the cost)
  affiliateCommissionPercent: number = 20, // Affiliate gets % of the final sale price
  hasRecruiter: boolean = true // If affiliate was recruited, 5% of sale is paid to recruiter from platform fee
): {
  cjCost: number;
  yourProfit: number;
  affiliateCommission: number;
  recruiterCommission: number;
  beezioFee: number;
  beezioNet: number;
  stripeFee: number;
  finalPrice: number;
  breakdown: string;
} {
  const cleanCost = Number.isFinite(cjCost) ? cjCost : 0;
  const cleanMarkup = Number.isFinite(markupPercent) ? markupPercent : 0;
  const yourProfit = cleanCost * (cleanMarkup / 100);
  const sellerAsk = cleanCost + yourProfit;

  const payout = {
    affiliatePercent: affiliateCommissionPercent,
    platformPercent: PLATFORM_FEE_PERCENT,
    fundraiserPercent: DEFAULT_PAYOUT_SETTINGS.fundraiserPercent,
  };

  const finalPrice = calculateFinalPrice(sellerAsk, payout);
  const payouts = computePayoutBreakdown(finalPrice, sellerAsk, payout, {
    referralOverrideEnabled: Boolean(hasRecruiter),
  });

  const affiliateCommission = payouts.affiliateAmount;
  const recruiterCommission = payouts.referralAffiliateAmount;
  const beezioFee = payouts.platformGrossAmount;
  const beezioNet = payouts.beezioNetAmount;
  const stripeFee = payouts.stripePercentAmount + payouts.stripeFixedFee;

  // 9. Create breakdown text
  const breakdown = `
Customer Pays: $${finalPrice.toFixed(2)}
├─ CJ Cost: $${cleanCost.toFixed(2)} (paid to CJ)
├─ Your Profit: $${yourProfit.toFixed(2)} (${markupPercent}% markup)
├─ Affiliate Commission: $${affiliateCommission.toFixed(2)} (${affiliateCommissionPercent}% of sale)
${hasRecruiter ? `├─ Recruiter Commission: $${recruiterCommission.toFixed(2)} (5% of sale, funded from Beezio fee)` : ''}
├─ Beezio Fee (Gross): $${beezioFee.toFixed(2)} (15% platform fee${sellerAsk <= 20 ? ' + $1 under-$20 surcharge' : ''})
${hasRecruiter ? `├─ Beezio Fee (Net): $${beezioNet.toFixed(2)} (Beezio keeps 10% of sale${sellerAsk <= 20 ? ' + $1 under-$20 surcharge' : ''})` : ''}
└─ Stripe Fee: $${stripeFee.toFixed(2)} (${payouts.stripePercentAmount.toFixed(2)} + ${payouts.stripeFixedFee.toFixed(2)})
`;

  return {
    cjCost: parseFloat(cleanCost.toFixed(2)),
    yourProfit: parseFloat(yourProfit.toFixed(2)),
    affiliateCommission: parseFloat(affiliateCommission.toFixed(2)),
    recruiterCommission: parseFloat(recruiterCommission.toFixed(2)),
    beezioFee: parseFloat(beezioFee.toFixed(2)),
    beezioNet: parseFloat(beezioNet.toFixed(2)),
    stripeFee: parseFloat(stripeFee.toFixed(2)),
    finalPrice: parseFloat(finalPrice.toFixed(2)),
    breakdown,
  };
}

/**
 * Map CJ category to Beezio category
 * This will need to be customized based on your category structure
 */
export function mapCJCategoryToBeezio(cjCategoryName: string): string {
  const categoryMap: Record<string, string> = {
    'Electronics': 'electronics',
    'Clothing & Accessories': 'fashion',
    'Home & Garden': 'home-garden',
    'Sports & Outdoors': 'sports',
    'Beauty & Health': 'beauty',
    'Toys & Games': 'toys',
    'Jewelry & Watches': 'jewelry',
    'Bags & Shoes': 'accessories',
    // Add more mappings as needed
  };

  return categoryMap[cjCategoryName] || 'other';
}

export default {
  getCJProducts,
  getCJProductDetail,
  getCJCategories,
  createCJOrder,
  getCJOrderTracking,
  getCJProductInventory,
  calculateBeezioPrice,
  mapCJCategoryToBeezio,
};
