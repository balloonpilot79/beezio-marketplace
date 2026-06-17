export const TEST_ITEM_TITLE = 'test item';
export const TEST_ITEM_PRICE = 0.99;
export const TEST_ITEM_SELLER_AMOUNT = 0.76;
export const TEST_ITEM_AFFILIATE_AMOUNT = 0.02;
export const TEST_ITEM_BEEZIO_FEE = 0.05;
export const TEST_ITEM_INFLUENCER_FEE = 0.01;
export const TEST_ITEM_PLATFORM_GROSS = TEST_ITEM_BEEZIO_FEE + (TEST_ITEM_INFLUENCER_FEE * 2);
export const TEST_ITEM_PROCESSING_FEE = TEST_ITEM_PRICE - TEST_ITEM_SELLER_AMOUNT - TEST_ITEM_AFFILIATE_AMOUNT - TEST_ITEM_PLATFORM_GROSS;

export const isTestItemTitle = (value: unknown): boolean =>
  String(value || '').trim().toLowerCase().startsWith(TEST_ITEM_TITLE);
