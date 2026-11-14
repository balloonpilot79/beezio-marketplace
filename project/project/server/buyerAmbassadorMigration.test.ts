import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const buyer = '11111111-1111-4111-8111-111111111111';
const shopper = '22222222-2222-4222-8222-222222222222';
const business = '33333333-3333-4333-8333-333333333333';
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth; create schema beezio_private;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
    create table public.profiles(id uuid primary key,user_id uuid,role text,primary_role text,recruited_by_influencer_id uuid);
    create table public.user_roles(user_id uuid,role text,is_active boolean,unique(user_id,role));
    create table public.influencer_referrals(recruited_profile_id uuid,recruited_role text,influencer_profile_id uuid,updated_at timestamptz,unique(recruited_profile_id,recruited_role));`);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261114153755_buyer_ambassadors_without_business_access.sql', import.meta.url), 'utf8'));
  await db.exec(`create trigger enforce before insert or update on public.influencer_referrals for each row execute function public.enforce_influencer_referrals();
    create trigger business after insert on auth.users for each row execute function public.attach_business_influencer_referral_from_signup();
    create trigger shopper after insert on auth.users for each row execute function beezio_private.attach_buyer_referral_from_signup();
    insert into public.profiles(id,user_id,role,primary_role) values ('${buyer}','${buyer}','buyer','buyer'),('${shopper}','${shopper}','buyer','buyer'),('${business}','${business}','seller','seller');
    insert into public.user_roles values ('${buyer}','buyer',true);
    insert into auth.users values ('${shopper}','{"role":"buyer","buyer_referrer_profile_id":"${buyer}"}'),('${business}','{"role":"seller","bundle_business_roles":true,"referrer_profile_id":"${buyer}"}');`);
}, 30000);
afterAll(async () => { await db?.close(); });

describe('buyer ambassador signup attribution', () => {
  it('locks all three referral types to the buyer', async () => {
    const result = await db.query('select recruited_role,influencer_profile_id from public.influencer_referrals order by recruited_role');
    expect(result.rows).toEqual(['affiliate', 'buyer', 'seller'].map(recruited_role => ({ recruited_role, influencer_profile_id: buyer })));
  });
  it('keeps the referring buyer out of business roles', async () => {
    expect((await db.query('select role from public.user_roles where user_id=$1', [buyer])).rows).toEqual([{ role: 'buyer' }]);
    expect((await db.query('select role,primary_role from public.profiles where id=$1', [buyer])).rows).toEqual([{ role: 'buyer', primary_role: 'buyer' }]);
  });
  it('rejects self-referrals and reassignment', async () => {
    await expect(db.query("insert into public.influencer_referrals values ($1,'buyer',$1,now())", [buyer])).rejects.toThrow('cannot be recruited by itself');
    await expect(db.query('update public.influencer_referrals set influencer_profile_id=$1 where recruited_profile_id=$2', [business, shopper])).rejects.toThrow('locked once assigned');
  });
  it('rejects inactive buyer referrers', async () => {
    await db.query("update public.user_roles set is_active=false where user_id=$1", [buyer]);
    await expect(db.query("insert into public.influencer_referrals values ($1,'buyer',$2,now())", [business, buyer])).rejects.toThrow('eligible ambassador');
  });
});
