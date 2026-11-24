import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { parseSignupAddress } from '../src/utils/signupAddress';

const migration = readFileSync('supabase/migrations/20261124011802_require_signup_address.sql', 'utf8');
const address = {
  street_address: ' 123 Test St ',
  city: ' Boston ',
  state: 'ma',
  zip_code: '02108-1234',
};

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE supabase_auth_admin;
    CREATE SCHEMA auth;
    CREATE SCHEMA beezio_private;
    CREATE TABLE auth.users (id integer PRIMARY KEY, raw_user_meta_data jsonb);
    CREATE TABLE public.profiles (
      user_id integer PRIMARY KEY, street_address text, city text,
      state text, zip_code text, country text, location text
    );
    CREATE FUNCTION public.create_test_profile() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO public.profiles (user_id, location) VALUES (NEW.id, 'Public city');
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER on_auth_user_created_create_profile AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.create_test_profile();
  `);
  await db.exec(migration);
}, 30_000);

afterAll(async () => { await db?.close(); });

it('accepts a full address and rejects missing or malformed address fields', async () => {
  const result = await db.query<{ body: Record<string, unknown> }>(
    'SELECT public.hook_require_signup_address($1::jsonb) AS body',
    [{ user: { user_metadata: address } }],
  );
  expect(result.rows[0].body).toEqual({});

  for (const invalid of [
    {},
    { ...address, street_address: '\t ' },
    { ...address, city: 123 },
    { ...address, state: 'XX' },
    { ...address, zip_code: '2108' },
  ]) {
    const rejected = await db.query(
      'SELECT public.hook_require_signup_address($1::jsonb) AS body',
      [{ user: { user_metadata: invalid } }],
    );
    expect(rejected.rows[0]).toMatchObject({ body: { error: { http_code: 400 } } });
  }
});

it('stores address data when the profile is created and preserves old profiles', async () => {
  await db.query('INSERT INTO auth.users VALUES ($1, $2)', [1, {}]);
  await db.query('INSERT INTO auth.users VALUES ($1, $2)', [2, address]);

  const { rows } = await db.query('SELECT * FROM public.profiles ORDER BY user_id');
  expect(rows).toEqual([
    { user_id: 1, street_address: null, city: null, state: null, zip_code: null, country: null, location: 'Public city' },
    { user_id: 2, street_address: '123 Test St', city: 'Boston', state: 'MA', zip_code: '02108-1234', country: 'US', location: null },
  ]);
});

it('normalizes signup addresses and preserves leading zeroes in ZIP codes', () => {
  expect(parseSignupAddress({ streetAddress: ' 123 Test St ', city: ' Boston ', state: 'Massachusetts', zipCode: '02108' }))
    .toEqual({ streetAddress: '123 Test St', city: 'Boston', state: 'MA', zipCode: '02108' });
  expect(() => parseSignupAddress({ streetAddress: ' ', city: 'Boston', state: 'MA', zipCode: '02108' }))
    .toThrow('Enter your street address and city.');
});
