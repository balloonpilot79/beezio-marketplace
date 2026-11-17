import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
let db: PGlite;
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`create role authenticated; create role service_role;
    create table paypal_accounts(user_id text,role text,paypal_email text,is_verified boolean default false, primary key(user_id,role));
    grant select,insert,update on paypal_accounts to authenticated,service_role;`);
  await db.exec(readFileSync('supabase/migrations/20261117180000_preserve_paypal_verification_on_same_email.sql','utf8'));
  await db.exec(`create trigger protect_paypal_account_verification before insert or update on paypal_accounts for each row execute function protect_paypal_account_verification();`);
});
afterAll(async()=>{await db.close();});
beforeEach(async()=>{await db.exec(`reset role; truncate paypal_accounts; insert into paypal_accounts values('owner','SELLER','owner@example.com',true);`);});
async function verified(){await db.exec('reset role'); return (await db.query<{is_verified:boolean}>('select is_verified from paypal_accounts where role=\'SELLER\'')).rows[0].is_verified;}
describe('server-owned payout verification',()=>{
  it('preserves verification for repeated browser Save and email case/spacing',async()=>{
    await db.exec(`set role authenticated; insert into paypal_accounts(user_id,role,paypal_email) values('owner','SELLER',' OWNER@EXAMPLE.COM ') on conflict(user_id,role) do update set paypal_email=excluded.paypal_email,is_verified=excluded.is_verified;`);
    expect(await verified()).toBe(true);
  });
  it('also protects already-open older clients sending false',async()=>{
    await db.exec(`set role authenticated; update paypal_accounts set is_verified=false;`); expect(await verified()).toBe(true);
  });
  it('revokes verification on email change even when a browser submits true',async()=>{
    await db.exec(`set role authenticated; update paypal_accounts set paypal_email='other@example.com',is_verified=true;`); expect(await verified()).toBe(false);
  });
  it('never permits a browser to verify a new account or unverified row',async()=>{
    await db.exec(`set role authenticated; insert into paypal_accounts values('new','SELLER','new@example.com',true); update paypal_accounts set is_verified=true where user_id='new'; reset role;`);
    const result=await db.query<{is_verified:boolean}>(`select is_verified from paypal_accounts where user_id='new'`); expect(result.rows[0].is_verified).toBe(false);
  });
  it('allows the server to verify and revoke an account',async()=>{
    await db.exec(`set role service_role; update paypal_accounts set paypal_email='other@example.com',is_verified=true;`); expect(await verified()).toBe(true);
    await db.exec(`set role service_role; update paypal_accounts set is_verified=false;`); expect(await verified()).toBe(false);
  });
  it('revokes verification if a browser changes the owner or role',async()=>{
    await db.exec(`set role authenticated; update paypal_accounts set role='PARTNER',is_verified=true; reset role;`);
    expect((await db.query<{is_verified:boolean}>('select is_verified from paypal_accounts')).rows[0].is_verified).toBe(false);
  });
});
