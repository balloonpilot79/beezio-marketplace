import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
vi.mock('../lib/supabase',()=>({supabase:{auth:{getSession:async()=>({data:{session:null}})}}}));
import {CartProvider,useCart} from './CartContext';
let cart:ReturnType<typeof useCart>,view:ReactTestRenderer;
const stored=new Map<string,string>();
const listeners=new Map<string,()=>void>();
const item={id:'cart-old',productId:'old',quantity:1,price:1,title:'Old item',sellerId:'seller',sellerName:'Seller',image:''};
function Harness(){cart=useCart();return null}
const mount=async()=>{await act(async()=>{view=create(<CartProvider><Harness/></CartProvider>)})};
beforeEach(()=>{
 stored.clear();listeners.clear();
 vi.stubGlobal('localStorage',{getItem:(k:string)=>stored.get(k)??null,setItem:(k:string,v:string)=>stored.set(k,v),removeItem:(k:string)=>stored.delete(k)});
 vi.stubGlobal('window',{addEventListener:(k:string,fn:()=>void)=>listeners.set(k,fn),removeEventListener:()=>{},setTimeout,clearTimeout});
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}')));
});
afterEach(async()=>{await act(async()=>view?.unmount());vi.unstubAllGlobals()});
describe('cart persistence',()=>{
 it('respects an empty current cart instead of resurrecting an old nonempty legacy copy',async()=>{
  stored.set('beezio-cart-global-guest','[]');stored.set('beezio-cart',JSON.stringify([item]));
  await mount();expect(cart.items).toEqual([]);
 });
 it('keeps the last item removed after refresh',async()=>{
  stored.set('beezio-cart-global-guest',JSON.stringify([item]));await mount();
  await act(async()=>cart.removeFromCart(item.id));
  expect(JSON.parse(stored.get('beezio-cart-global-guest')!)).toEqual([]);
  await act(async()=>view.unmount());stored.set('beezio-cart',JSON.stringify([item]));
  await mount();expect(cart.items).toEqual([]);
 });
 it('loads the new scope without overwriting it with the previous scope during hydration',async()=>{
  stored.set('beezio-cart-global-guest',JSON.stringify([item]));
  stored.set('beezio-cart-shop-guest',JSON.stringify([{...item,id:'other',productId:'other'}]));await mount();
  stored.set('beezio-store-scope','shop');await act(async()=>listeners.get('beezio-store-scope-changed')!());
  expect(cart.items[0].id).toBe('other');
  expect(JSON.parse(stored.get('beezio-cart-shop-guest')!)[0].id).toBe('other');
 });
});
