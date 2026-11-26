import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20261126025514_unique_store_display_names.sql', 'utf8');
const requiredNameMigration = readFileSync('supabase/migrations/20261126031458_require_store_display_names.sql', 'utf8');
const firstOwner = '11111111-1111-4111-8111-111111111111';
const secondOwner = '22222222-2222-4222-8222-222222222222';
const nameTaken = { code: 'BZ001', message: 'That store name is already taken. Choose a different name.' };
let db: PGlite;

beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create schema extensions;
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create table profiles (id uuid primary key, user_id uuid, email text, full_name text);
    create table store_settings (id uuid primary key default gen_random_uuid(), seller_id uuid unique, store_name text, store_theme text, subdomain text);
    create table affiliate_store_settings (id uuid primary key default gen_random_uuid(), affiliate_id uuid unique, store_name text, store_theme text, subdomain text, is_active boolean);
    create table storefronts (id uuid primary key default gen_random_uuid(), owner_id uuid, name text, slug text unique);
    create function public.unique_store_slug_for_bootstrap(base text, target text, owner uuid)
      returns text language sql as $$ select base $$;

    insert into profiles (id, user_id) values ('${firstOwner}', '${firstOwner}'), ('${secondOwner}', '${secondOwner}');
    insert into auth.users (id,email,raw_user_meta_data) values
      ('${secondOwner}', 'second@example.invalid', '{"store_name":"Oak Supply","store_slug":"second-store"}');
    insert into store_settings (seller_id,store_name,subdomain) values ('${firstOwner}', 'Oak Supply','oak-supply');
    insert into affiliate_store_settings (affiliate_id,store_name,subdomain) values ('${firstOwner}', 'Oak Supply','oak-supply');
    insert into storefronts (owner_id,name,slug) values ('${firstOwner}', 'Oak Supply','oak-supply');
  `);
  await db.transaction(async (tx) => { await tx.exec(migration); await tx.exec(requiredNameMigration); });
}, 30_000);

afterAll(async () => { await db?.close(); });

it('allows the existing mirrored store and rejects the same name for other storefronts', async () => {
  await expect(db.query(
    'insert into store_settings (seller_id,store_name,subdomain) values ($1,$2,$3)',
    [secondOwner, '\t OAK   SUPPLY ', 'another-slug'],
  )).rejects.toMatchObject(nameTaken);
  await expect(db.query(
    'insert into storefronts (owner_id,name,slug) values ($1,$2,$3)',
    [firstOwner, 'Oak Supply', 'second-brand'],
  )).rejects.toMatchObject(nameTaken);
  await db.exec('set role anon');
  try {
    const result = await db.query("select is_store_name_available('oak supply') as taken, is_store_name_available('oak outlet') as free");
    expect(result.rows).toEqual([{ taken: false, free: true }]);
    await expect(db.query('select * from beezio_store_names.claims')).rejects.toMatchObject({ code: '42501' });
  } finally {
    await db.exec('reset role');
  }
});

it('bootstraps a distinct default and releases names after the last matching record is removed', async () => {
  await db.query('select ensure_default_custom_stores_for_profile($1)', [secondOwner]);
  const result = await db.query(
    'select s.store_name as seller, a.store_name as affiliate from store_settings s join affiliate_store_settings a on a.affiliate_id=s.seller_id where s.seller_id=$1',
    [secondOwner],
  );
  expect(result.rows).toEqual([{ seller: 'Oak Supply 2', affiliate: 'Oak Supply 2' }]);
  await expect(db.query('update store_settings set store_name=$2 where seller_id=$1', [secondOwner, 'Oak Supply'])).rejects.toMatchObject(nameTaken);
  await expect(db.query('update affiliate_store_settings set store_name=$2 where affiliate_id=$1', [secondOwner, 'Oak Supply'])).rejects.toMatchObject(nameTaken);
  await db.query('delete from storefronts where owner_id=$1', [firstOwner]);
  await db.query('update store_settings set store_name=$2 where seller_id=$1', [firstOwner, 'Oak Workshop']);
  expect((await db.query("select is_store_name_available('Oak Supply') as free")).rows).toEqual([{ free: false }]);
  await db.query('delete from affiliate_store_settings where affiliate_id=$1', [firstOwner]);
  await db.query('update store_settings set store_name=$2 where seller_id=$1', [secondOwner, 'Oak Supply']);
});

it('requires a real name so public stores cannot fall back to a profile name', async () => {
  await expect(db.query('update store_settings set store_name=$2 where seller_id=$1', [secondOwner, ' \t ']))
    .rejects.toMatchObject({ code: '23514', constraint: 'seller_store_display_name_required' });
  await expect(db.query('update affiliate_store_settings set store_name=null where affiliate_id=$1', [secondOwner]))
    .rejects.toMatchObject({ code: '23514', constraint: 'affiliate_store_display_name_required' });
});
