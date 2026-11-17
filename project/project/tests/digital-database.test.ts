import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
const seller='11111111-1111-4111-8111-111111111111', buyer='22222222-2222-4222-8222-222222222222', other='33333333-3333-4333-8333-333333333333';
let db:PGlite;
const scalar=async(sql:string)=> (await db.query<any>(sql)).rows[0];
const consume=(id:string,who=buyer)=>db.query(`select public.consume_digital_download('${id}','${who}','test','2026-11-17') remaining`);
let entitlement:string;
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema storage;
 create table auth.users(id uuid primary key); insert into auth.users values('${seller}'),('${buyer}'),('${other}');
 create table public.profiles(id uuid primary key,user_id uuid); insert into profiles values('${seller}','${seller}');
 create table public.products(id uuid primary key,seller_id uuid,title text,is_digital boolean,digital_download_path text,digital_download_bucket text,digital_download_filename text,digital_download_content_type text,digital_download_file_size bigint,digital_download_limit integer,digital_return_policy_notice text,digital_download_instructions text,requires_shipping boolean,shipping_cost numeric,shipping_price numeric,shipping_reserve_amount numeric,shipping_options jsonb,track_inventory boolean,in_stock boolean);
 create table public.orders(id uuid primary key,customer_email text,status text,payment_status text,paid_at timestamptz,payment_finalized_at timestamptz,provider_capture_id text,dispute_status text);
 create table public.order_items(id uuid primary key,order_id uuid references orders(id),product_id uuid references products(id),seller_id uuid);
 create table public.disputes(order_id uuid,status text);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text);
 `);
 await db.exec(readFileSync('supabase/migrations/20261117080354_secure_digital_downloads.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261117085253_large_private_digital_uploads.sql','utf8'));
 await db.exec(`select public.reserve_digital_upload('${seller}','${seller}/one.txt','one.txt','text/plain',5,'hash1'); insert into storage.objects values('digital-products-private','${seller}/one.txt');
 insert into products(id,seller_id,title,is_digital,digital_download_path,digital_download_limit) values('${seller}','${seller}','Download',true,'${seller}/one.txt',1);
 insert into orders(id,status,payment_status,digital_buyer_user_id,digital_policy_version,digital_policy_accepted_at) values('${buyer}','created','unpaid','${buyer}','2026-11-17',now());
 insert into order_items values('${buyer}','${buyer}','${seller}','${seller}');`);
 entitlement=(await scalar('select id from digital_download_entitlements')).id;
},30000);
afterAll(async()=>{await db?.close()});
describe.sequential('digital delivery database lifecycle',()=>{
 it('keeps unpaid downloads pending and rejects access',async()=>{expect((await scalar('select access_status from digital_download_entitlements')).access_status).toBe('pending');await expect(consume(entitlement)).rejects.toThrow();});
 it('canonicalizes digital shipping to zero',async()=>{expect(await scalar('select requires_shipping,shipping_cost,track_inventory from products')).toEqual({requires_shipping:false,shipping_cost:'0',track_inventory:false});});
 it('cannot attach another seller file or an unvalidated path',async()=>{await expect(db.exec("update products set digital_download_path='somebody/secret.pdf' ")).rejects.toThrow(/owned|validation/)});
 it('does not activate on a paid status without finalized capture',async()=>{await db.exec("update orders set payment_status='paid',paid_at=now()");expect((await scalar('select access_status from digital_download_entitlements')).access_status).toBe('pending');});
 it('activates from finalized payment, including webhook path',async()=>{await db.exec("update orders set provider_capture_id='capture',payment_finalized_at=now()");expect((await scalar('select access_status from digital_download_entitlements')).access_status).toBe('active');});
 it('rejects another buyer',async()=>{await expect(consume(entitlement,other)).rejects.toThrow(/unavailable/)});
 it('holds access on disputes',async()=>{await db.exec("update orders set dispute_status='OPEN'");await expect(consume(entitlement)).rejects.toThrow(/dispute/);await db.exec("update orders set dispute_status='NONE'");});
 it('serializes concurrent access and records exactly one access',async()=>{const result=await Promise.allSettled([consume(entitlement),consume(entitlement)]);expect(result.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect((await scalar('select count(*) n from digital_download_events')).n).toBe(1);expect((await scalar('select first_access_at is not null yes from digital_download_entitlements')).yes).toBe(true);});
 it('payment replay never resets counts or reactivates exhausted access',async()=>{await db.exec("update orders set payment_status='paid'");expect(await scalar('select access_status,download_count from digital_download_entitlements')).toEqual({access_status:'exhausted',download_count:1});});
 it('refund revokes access',async()=>{await db.exec("update orders set status='refunded'");expect((await scalar('select access_status from digital_download_entitlements')).access_status).toBe('revoked');});
 it('does not let anonymous or authenticated clients call service RPCs or read private records',async()=>{for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await expect(consume(entitlement)).rejects.toThrow(/permission/);await expect(db.query('select * from digital_file_uploads')).rejects.toThrow(/permission/);await db.exec('reset role');}});
 it('leaves physical product/order inserts independent of digital delivery',async()=>{await db.exec(`insert into products(id,title,is_digital,shipping_cost) values('${other}','Physical',false,8);insert into orders(id) values('${other}');insert into order_items values('${other}','${other}','${other}',null)`);expect((await scalar(`select shipping_cost from products where id='${other}'`)).shipping_cost).toBe('8');expect((await scalar('select count(*) n from digital_download_entitlements')).n).toBe(1);});
 it('reserves 50 MB directly, blocks pending publication and only allows its owner to claim validation',async()=>{
  const row=await scalar(`select public.begin_digital_upload('${seller}','${seller}/final-large.txt','${seller}/quarantine-large.txt','large.txt','text/plain',52428800) id`);
  await db.exec(`insert into storage.objects values('digital-products-private','${seller}/final-large.txt')`);
  await expect(db.exec(`insert into products(id,seller_id,title,is_digital,digital_download_path) values('44444444-4444-4444-8444-444444444444','${seller}','Pending file',true,'${seller}/final-large.txt')`)).rejects.toThrow(/validation/);
  expect((await db.query(`select * from public.claim_digital_upload('${row.id}','${buyer}')`)).rows).toHaveLength(0);
  expect((await db.query(`select * from public.claim_digital_upload('${row.id}','${seller}')`)).rows).toHaveLength(1);
  expect((await db.query(`select * from public.claim_digital_upload('${row.id}','${seller}')`)).rows).toHaveLength(0);
  await db.exec(`update digital_file_uploads set validation_status='approved',sha256='large-hash' where upload_id='${row.id}'`);
  await db.exec(`insert into products(id,seller_id,title,is_digital,digital_download_path) values('44444444-4444-4444-8444-444444444444','${seller}','Approved large file',true,'${seller}/final-large.txt')`);
  expect((await scalar("select digital_download_file_size n from products where id='44444444-4444-4444-8444-444444444444'")).n).toBe(52428800);
 });
 it('rejects oversized direct reservations and crossed seller paths',async()=>{
  await expect(db.query(`select public.begin_digital_upload('${seller}','${seller}/x','${seller}/q','x.txt','text/plain',52428801)`)).rejects.toThrow(/50 MB/);
  await expect(db.query(`select public.begin_digital_upload('${seller}','${buyer}/x','${seller}/q','x.txt','text/plain',4)`)).rejects.toThrow(/path/);
 });
 it('keeps direct-upload RPCs service-only',async()=>{
  await db.exec('set role authenticated');
  await expect(db.query(`select public.begin_digital_upload('${seller}','${seller}/x','${seller}/q','x.txt','text/plain',4)`)).rejects.toThrow(/permission/);
  await db.exec('reset role');
 });

});
