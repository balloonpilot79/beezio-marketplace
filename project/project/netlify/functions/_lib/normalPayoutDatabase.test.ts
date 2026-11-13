import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
let db: PGlite;
const uuid = (n: number) =>
  "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const batch = uuid(1),
  order = uuid(2),
  ledger = uuid(3),
  payee = uuid(4),
  credit = uuid(5),
  item = uuid(6);
const setup = `
 CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE TYPE public.payout_item_status AS ENUM('PREPARED','CREATED','SENT','FAILED');
 CREATE TYPE public.paypal_account_role AS ENUM('SELLER','PARTNER','INFLUENCER');
 CREATE TABLE public.orders(id uuid PRIMARY KEY,status text,payment_status text,provider_capture_id text,paid_at timestamptz,dispute_status text,updated_at timestamptz);
 CREATE TABLE public.payout_ledger(id uuid PRIMARY KEY,order_id uuid,status text,hold_release_at timestamptz,updated_at timestamptz);
 CREATE TABLE public.payout_snapshots(id uuid PRIMARY KEY,ledger_id uuid,order_id uuid,status text,updated_at timestamptz);
 CREATE TABLE public.payout_batches(id uuid PRIMARY KEY,status text,payout_date date,updated_at timestamptz,failure_reason text);
 CREATE TABLE public.payout_items(id uuid PRIMARY KEY,payout_batch_id uuid,ledger_id uuid,payee_user_id uuid,payee_role public.paypal_account_role,order_money_ledger_id uuid,amount numeric,recipient text,status public.payout_item_status,error_message text,updated_at timestamptz);
 CREATE TABLE public.order_money_ledger(id uuid PRIMARY KEY,order_id uuid,payee_id uuid,payee_type text,status text,net_amount numeric,currency text,hold_until timestamptz,payout_batch_id uuid,updated_at timestamptz);
 CREATE TABLE public.paypal_accounts(user_id uuid,role public.paypal_account_role,paypal_email text,is_verified boolean);
 CREATE TABLE public.disputes(id uuid PRIMARY KEY,order_id uuid,status text,description text,resolution text,resolution_type text,updated_at timestamptz DEFAULT now());
 CREATE TABLE public.dispute_messages(id uuid PRIMARY KEY,dispute_id uuid,message text);
 CREATE OR REPLACE FUNCTION pg_catalog.clock_timestamp() RETURNS timestamptz LANGUAGE sql AS $$SELECT '2026-11-15T18:00:00Z'::timestamptz$$;
`;
async function seed(amount = 5) {
  await db.query(
    `INSERT INTO orders VALUES($1,'paid','paid','capture','2026-11-01T18:00:00Z','NONE',clock_timestamp())`,
    [order],
  );
  await db.query(
    `INSERT INTO payout_ledger VALUES($1,$2,'READY_TO_PAY','2026-11-15T18:00:00Z',clock_timestamp())`,
    [ledger, order],
  );
  await db.query(
    `INSERT INTO payout_batches VALUES($1,'PREPARED','2026-11-15',clock_timestamp(),null)`,
    [batch],
  );
  await db.query(
    `INSERT INTO payout_items(id,payout_batch_id,ledger_id,payee_user_id,payee_role,order_money_ledger_id,amount,recipient,status) VALUES($1,$2,$3,$4,'SELLER',$5,$6,'seller@example.com','PREPARED')`,
    [item, batch, ledger, payee, credit, amount],
  );
  await db.query(
    `INSERT INTO order_money_ledger(id,order_id,payee_id,payee_type,status,net_amount,currency,hold_until) VALUES($1,$2,$3,'seller','ready',$4,'USD','2026-11-15T18:00:00Z')`,
    [credit, order, payee, amount],
  );
  await db.query(
    `INSERT INTO paypal_accounts VALUES($1,'SELLER','seller@example.com',true)`,
    [payee],
  );
}
async function reserve() {
  return db.query("select reserve_normal_payout_credits($1)", [batch]);
}
async function lock() {
  return db.query("select lock_normal_payout_submission($1)", [batch]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(setup);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261113064202_normal_payouts_and_owner_dispute_alerts.sql",
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    "TRUNCATE orders,payout_ledger,payout_snapshots,payout_batches,payout_items,order_money_ledger,paypal_accounts,disputes,dispute_messages,owner_alert_outbox",
  );
});
describe("normal payout database guarantees", () => {
  it("reserves exact credits and allows only one submission lock", async () => {
    await seed();
    await reserve();
    await lock();
    await expect(lock()).rejects.toThrow(/already submitted/);
  });
  it("prevents a second prepared reservation for the same order, payee and role", async () => {
    await seed();
    await expect(
      db.query(
        `INSERT INTO payout_items(id,payout_batch_id,ledger_id,payee_user_id,payee_role,amount,status) VALUES($1,$2,$3,$4,'SELLER',5,'PREPARED')`,
        [uuid(7), uuid(8), ledger, payee],
      ),
    ).rejects.toThrow(/unique/);
  });
  it("refuses the final millisecond before the full hold expires", async () => {
    await seed();
    await db.query(`UPDATE orders SET paid_at='2026-11-01T18:00:00.001Z'`);
    await expect(reserve()).rejects.toThrow(/changed/);
  });
  it("blocks amounts below five dollars at submission", async () => {
    await seed(4.99);
    await reserve();
    await expect(lock()).rejects.toThrow(/minimum/);
  });
  it("detects an amount mismatch and rolls back the entire reservation", async () => {
    await seed();
    await db.exec("UPDATE payout_items SET amount=6");
    await expect(reserve()).rejects.toThrow(/changed/);
    expect(
      (await db.query("select payout_batch_id from order_money_ledger")).rows[0]
        .payout_batch_id,
    ).toBeNull();
  });
  it("freezes earnings and saves an owner alert when a dispute opens after preparation", async () => {
    await seed();
    await reserve();
    await db.query(
      `INSERT INTO disputes(id,order_id,status,description) VALUES($1,$2,'open','Please review')`,
      [uuid(9), order],
    );
    await expect(lock()).rejects.toThrow(/not eligible/);
    expect(
      (await db.query("select status from order_money_ledger")).rows[0].status,
    ).toBe("on_hold_dispute");
    expect(
      (await db.query("select count(*)::int as n from owner_alert_outbox"))
        .rows[0].n,
    ).toBe(1);
  });
  it("blocks refunds or a changed PayPal destination after preparation", async () => {
    await seed();
    await reserve();
    await db.exec("UPDATE orders SET payment_status='refunded'");
    await expect(lock()).rejects.toThrow(/not eligible/);
    await db.exec(
      "UPDATE orders SET payment_status='paid';UPDATE paypal_accounts SET paypal_email='other@example.com'",
    );
    await expect(lock()).rejects.toThrow(/verified/);
  });
  it("never releases an uncertain in-flight payout using the prepared-failure path", async () => {
    await seed();
    await reserve();
    await lock();
    const r = await db.query(
      "select fail_normal_payout_batch($1,$2,$3) as released",
      [batch, "PREPARED", "retry"],
    );
    expect(r.rows[0].released).toBe(false);
    expect(
      (await db.query("select payout_batch_id from order_money_ledger")).rows[0]
        .payout_batch_id,
    ).toBe(batch);
  });
  it("rejects submission on a different payout date", async () => {
    await seed();
    await reserve();
    await db.exec("UPDATE payout_batches SET payout_date='2026-11-30'");
    await expect(lock()).rejects.toThrow(/payday/);
  });
  it("claims an owner alert only once while its delivery lease is active", async () => {
    await db.exec(
      "INSERT INTO owner_alert_outbox(event_key,payload,next_attempt_at) VALUES('test','{}','2026-11-01')",
    );
    expect(
      (await db.query("select * from claim_owner_alerts(5)")).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select * from claim_owner_alerts(5)")).rows,
    ).toHaveLength(0);
  });
  it("denies public execution of payout and alert workers", async () => {
    const r = await db.query(
      `select has_function_privilege('authenticated','lock_normal_payout_submission(uuid)','EXECUTE') as payout,has_function_privilege('anon','claim_owner_alerts(integer)','EXECUTE') as alert`,
    );
    expect(r.rows[0]).toEqual({ payout: false, alert: false });
  });
  it("aligns database payday helpers with month end", async () => {
    const r = await db.query(
      "select next_beezio_payday('2026-11-16')::text as date",
    );
    expect(r.rows[0].date).toBe("2026-11-30");
  });
});
