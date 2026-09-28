import { afterEach, describe, expect, it } from 'vitest';
import { getSecretKey } from './supabase';

const originalEnv = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SUPABASE_SECRET_KEYS: process.env.SUPABASE_SECRET_KEYS,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('getSecretKey', () => {
  it('prefers the production service-role key over stale alternate secrets', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'current-project-service-role';
    process.env.SUPABASE_SECRET_KEY = 'stale-project-secret';
    process.env.SUPABASE_SECRET_KEYS = JSON.stringify({ default: 'another-stale-secret' });

    expect(getSecretKey()).toBe('current-project-service-role');
  });

  it('supports the new secret key when no service-role key is configured', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SECRET_KEY = 'current-project-secret';
    delete process.env.SUPABASE_SECRET_KEYS;

    expect(getSecretKey()).toBe('current-project-secret');
  });
});
