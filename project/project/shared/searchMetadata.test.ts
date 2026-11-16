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
  it('includes empty sellers and affiliate-only stores, deduplicates brands, and excludes inactive stores and buyers', async () => {
    const tables: Record<string,any[]> = {
      storefronts:[{id:'b',slug:'brand',name:'Brand',is_active:true},{id:'off',slug:'inactive',is_active:false}],
      store_settings:[{seller_id:'s',subdomain:'empty-seller',store_name:'Seller'},{seller_id:'b',subdomain:'brand',store_name:'Wrong name'},{seller_id:'off',subdomain:'inactive'}],
      affiliate_store_settings:[{affiliate_id:'a',subdomain:'affiliate-only',store_name:'Affiliate',is_active:true},{affiliate_id:'x',subdomain:'inactive-affiliate',is_active:false}],
      profiles:[{id:'p',subdomain:'legacy-seller',role:'seller'},{id:'buyer',subdomain:'buyer',role:'buyer'},{id:'x',subdomain:'inactive-affiliate',role:'affiliate'}],
    };
    const db = {from:(table: string) => ({select:() => ({order:() => ({range:async(from: number,to: number) => ({data:tables[table].slice(from,to+1),error:null})})})})};
    const stores = await loadPublicSearchStores(db);
    expect(stores.map(s => s.slug).sort()).toEqual(['affiliate-only','brand','empty-seller','legacy-seller']);
    expect(stores.find(s => s.slug==='brand')?.name).toBe('Brand');
  });
  it('paginates store sources beyond the default database row limit', async () => {
    const sellers = Array.from({length:1002},(_,i) => ({seller_id:String(i),subdomain:`shop-${i}`}));
    const db = {from:(table: string) => ({select:() => ({order:() => ({range:async(from: number,to: number) => ({data:table==='store_settings' ? sellers.slice(from,to+1) : [],error:null})})})})};
    expect(await loadPublicSearchStores(db)).toHaveLength(1002);
  });
});
