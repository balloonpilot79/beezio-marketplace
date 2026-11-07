import { describe, expect, it } from 'vitest';
import { cardEmbed, collectionLink, parseCollectionIds, promotionCaption, promotionPrice } from './promotionKit';
const p={id:'f880d031-d3c6-4a09-b39d-b081a031d69e',title:'Horse <shirt>',price:29.99,calculated_customer_price:29.99,shipping_reserve_amount:5.99,images:['https://example.com/image.jpg']};
describe('promotion kit',()=>{
  it('advertises the complete saved pre-tax total without adding shipping twice',()=>{
    expect(promotionPrice(p)).toBeCloseTo(29.99);
    expect(promotionPrice({...p,price:59,calculated_customer_price:59,shipping_reserve_amount:0})).toBe(59);
  });
  it('keeps the personal tracking parameters on a collection',()=>{
    const url=new URL(collectionLink('https://beezio.co/product/a?ref=affiliate&uid=user&code=affiliate',[p.id,p.id],'Horse gifts'));
    expect(url.pathname).toBe('/picks');expect(url.searchParams.get('ref')).toBe('affiliate');expect(url.searchParams.get('uid')).toBe('user');expect(parseCollectionIds(url.searchParams.get('items')!)).toEqual([p.id]);
  });
  it('escapes website markup and retains attribution and disclosure',()=>{
    const html=cardEmbed({...p,title:'<script>alert("x")</script>'},'https://beezio.co/product/a?ref=me&uid=123');
    expect(html).not.toContain('<script>');expect(html).toContain('ref=me&amp;uid=123');expect(html).toContain('rel="sponsored noopener"');expect(html).toContain('may earn a commission');expect(html).not.toContain('<iframe');
  });
  it('rejects arbitrary collection identifiers and limits size',()=>{
    expect(parseCollectionIds('invalid,<script>,'+p.id)).toEqual([p.id]);
    expect(parseCollectionIds(Array.from({length:20},(_,i)=>`${String(i).padStart(8,'0')}-d3c6-4a09-b39d-b081a031d69e`).join(','))).toHaveLength(12);
  });
  it('includes disclosure and current price scope in captions',()=>{
    expect(promotionCaption(p,'https://beezio.co/product/a?ref=me')).toContain('$29.99');
    expect(promotionCaption(p,'https://beezio.co/product/a?ref=me')).toContain('delivery area');
    expect(promotionCaption(p,'https://beezio.co/product/a?ref=me')).toContain('may earn a commission');
  });
});
