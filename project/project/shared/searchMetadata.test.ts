import { describe, expect, it } from 'vitest';
import { injectSearchPage, productSearchData } from './searchMetadata';
import { loadPublicSearchStores } from '../netlify/functions/_lib/publicSearchStores';

const template = '<html><head><title>Old</title><link rel="canonical" href="https://old.example" /></head><body><div id="root"><div><div>Loading</div></div></div><script src="/assets/app.js"></script></body></html>';
describe('search visibility', () => {
  it('renders crawlable content inside the React root and preserves the app bundle', () => {
    const page = productSearchData({title:'Horse shirt',description:'A cotton shirt',price:30,shipping_cost:5,currency:'USD',images:[],seller_ask:8,affiliate_payout_amount:4},'product-id','https://storage.example');
    const html = injectSearchPage(template,page);
    expect(html).toContain('<h1>Horse shirt</h1>');
    expect(html).toContain('"price":"25.00"');
    expect(html).toContain('BreadcrumbList');
    expect(html).toContain('href="https://beezio.co/product/product-id"');
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html).not.toContain('seller_ask');
    expect(html).not.toContain('affiliate_payout_amount');
    expect(html).not.toContain('Loading');
    expect(html).toContain('</main></div><script src="/assets/app.js"></script>');
  });
  it('escapes script termination and seller HTML inside structured data', () => {
    const page = productSearchData({ title:'</script><script>alert(1)</script>',price:5,images:[] },'id','https://storage.example');
    const html = injectSearchPage(template,page);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('application/ld+json');
  });
  it('lists only stores with public products and keeps dedicated brand catalogs separate', async () => {
    const tables: Record<string,any[]> = {
      storefronts: [
        {id:'b',owner_id:'seller',slug:'brand',name:'Brand',is_active:true},
        {id:'empty',owner_id:'seller',slug:'empty-brand',is_active:true},
        {id:'off',owner_id:'seller',slug:'inactive',is_active:false},
      ],
      store_settings: [
        {seller_id:'s',subdomain:'empty-seller'},
        {seller_id:'seller',subdomain:'seller-shop'},
        {seller_id:'seller',subdomain:'empty-brand'},
        {seller_id:'seller',subdomain:'brand',store_name:'Wrong name'},
        {seller_id:'seller',subdomain:'inactive'},
        {seller_id:'curator',subdomain:'curated'},
      ],
      affiliate_store_settings: [
        {affiliate_id:'a',subdomain:'affiliate-only',is_active:true},
        {affiliate_id:'x',subdomain:'inactive-affiliate',is_active:false},
        {affiliate_id:'y',subdomain:'ineligible-affiliate',is_active:true},
        {affiliate_id:'z',subdomain:'deselected-affiliate',is_active:true},
      ],
      profiles: [
        {id:'p',user_id:'legacy-auth',subdomain:'legacy-seller',role:'seller'},
        {id:'buyer',subdomain:'buyer',role:'buyer'},
      ],
      products: [
        {id:'live',seller_id:'seller',is_active:true,status:'active'},
        {id:'store-only',seller_id:'seller',is_active:true,status:'store_only'},
        {id:'draft',seller_id:'s',is_active:true,status:'draft'},
        {id:'sold-out',seller_id:'s',is_active:true,stock_quantity:0},
        {id:'legacy-live',seller_id:'legacy-auth',is_active:true},
        {id:'buyer-live',seller_id:'buyer',is_active:true},
      ],
      storefront_products: [
        {storefront_id:'b',product_id:'store-only'},
        {storefront_id:'empty',product_id:'draft'},
      ],
      seller_product_order: [{seller_id:'curator',product_id:'live'}],
      affiliate_products: [
        {affiliate_id:'a',product_id:'live',is_active:true},
        {affiliate_id:'x',product_id:'live',is_active:true},
        {affiliate_id:'y',product_id:'store-only',is_active:true},
        {affiliate_id:'z',product_id:'live',is_active:false},
      ],
    };
    const db = {from:(table: string) => ({select:() => ({order:() => ({range:async(from: number,to: number) => ({data:tables[table].slice(from,to+1),error:null})})})})};
    const stores = await loadPublicSearchStores(db);
    expect(stores.map(s => s.slug).sort()).toEqual(['affiliate-only','brand','curated','legacy-seller','seller-shop']);
    expect(stores.find(s => s.slug==='brand')?.name).toBe('Brand');
  });
  it('paginates store sources beyond the default database row limit', async () => {
    const sellers = Array.from({length:1002},(_,i) => ({seller_id:String(i),subdomain:`shop-${i}`}));
    const products = sellers.map(seller => ({id:seller.seller_id,seller_id:seller.seller_id,is_active:true}));
    const tables: Record<string,any[]> = {store_settings:sellers,products};
    const db = {from:(table: string) => ({select:() => ({order:() => ({range:async(from: number,to: number) => ({data:(tables[table] || []).slice(from,to+1),error:null})})})})};
    expect(await loadPublicSearchStores(db)).toHaveLength(1002);
  });
});
