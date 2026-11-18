import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
const ambassador='11111111-1111-4111-8111-111111111111', business='22222222-2222-4222-8222-222222222222', newcomer='33333333-3333-4333-8333-333333333333', self='44444444-4444-4444-8444-444444444444';
const migration=readFileSync('supabase/migrations/20261118005601_shopper_referrals_for_business_accounts.sql','utf8');
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create schema auth;create schema beezio_private;create role anon;create role authenticated;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb,created_at timestamptz default now());
 create table profiles(id uuid primary key,user_id uuid,role text,primary_role text);
 create table user_roles(user_id uuid,role text,is_active boolean);
 create table influencer_referrals(recruited_profile_id uuid,recruited_role text,influencer_profile_id uuid,created_at timestamptz default now(),unique(recruited_profile_id,recruited_role));
 insert into profiles values('${ambassador}','${ambassador}','buyer','buyer');
 insert into user_roles values('${ambassador}','buyer',true);
 insert into influencer_referrals values('${business}','seller','${ambassador}','2026-11-17T20:16:29Z'),('${business}','affiliate','${ambassador}','2026-11-17T20:16:29Z');`);
 await db.exec(migration);
 await db.exec('create trigger signup after insert on auth.users for each row execute function beezio_private.attach_buyer_referral_from_signup()');
},30000);
afterAll(async()=>{await db?.close()});
it('restores the existing business account shopping referral with its original pre-purchase timestamp',async()=>{
 const result=await db.query<any>(`select influencer_profile_id,created_at < '2026-11-18T00:47:39Z' as predates_purchase from influencer_referrals where recruited_profile_id='${business}' and recruited_role='buyer'`);
 expect(result.rows).toEqual([{influencer_profile_id:ambassador,predates_purchase:true}]);
 await db.exec(migration);
 expect((await db.query(`select * from influencer_referrals where recruited_profile_id='${business}' and recruited_role='buyer'`)).rows).toHaveLength(1);
});
it('records shopping when a bundled business account registers through a universal invite',async()=>{
 await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[newcomer,{role:'seller',bundle_business_roles:true,referrer_profile_id:ambassador}]);
 expect((await db.query(`select recruited_role,influencer_profile_id from influencer_referrals where recruited_profile_id='${newcomer}'`)).rows).toEqual([{recruited_role:'buyer',influencer_profile_id:ambassador}]);
 expect((await db.query(`select * from user_roles where user_id='${ambassador}'`)).rows).toEqual([{user_id:ambassador,role:'buyer',is_active:true}]);
});
it('does not establish attribution from later metadata changes, self referrals, or invalid identifiers',async()=>{
 await db.query('update auth.users set raw_user_meta_data=$1 where id=$2',[{referrer_profile_id:self},newcomer]);
 expect((await db.query(`select influencer_profile_id from influencer_referrals where recruited_profile_id='${newcomer}'`)).rows).toEqual([{influencer_profile_id:ambassador}]);
 await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[self,{role:'seller',referrer_profile_id:self}]);
 expect((await db.query(`select * from influencer_referrals where recruited_profile_id='${self}'`)).rows).toEqual([]);
});
