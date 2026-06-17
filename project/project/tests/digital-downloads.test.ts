import { beforeEach, describe, expect, it, vi } from 'vitest';

const authGetUser = vi.fn();
const maybeSingle = vi.fn();
const eqSelect = vi.fn();
const select = vi.fn();
const eqUpdateBuyer = vi.fn();
const eqUpdateId = vi.fn();
const update = vi.fn();
const createSignedUrl = vi.fn();

vi.mock('../netlify/functions/_lib/supabase', () => ({
  createSupabaseAdmin: () => ({
    auth: {
      getUser: authGetUser,
    },
    from: (table: string) => {
      if (table !== 'digital_download_entitlements') {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: (...args: any[]) => {
          select(...args);
          return {
            eq: (...eqArgs: any[]) => {
              eqSelect(...eqArgs);
              return {
                eq: (...nestedEqArgs: any[]) => {
                  eqSelect(...nestedEqArgs);
                  return {
                    maybeSingle,
                  };
                },
              };
            },
          };
        },
        update: (...args: any[]) => {
          update(...args);
          return {
            eq: (...eqArgs: any[]) => {
              eqUpdateId(...eqArgs);
              return {
                eq: (...nestedEqArgs: any[]) => {
                  eqUpdateBuyer(...nestedEqArgs);
                  return { error: null };
                },
              };
            },
          };
        },
      };
    },
    storage: {
      from: () => ({
        createSignedUrl,
      }),
    },
  }),
}));

describe('digital-downloads handler', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authGetUser.mockResolvedValue({ data: { user: { id: 'buyer-1' } }, error: null });
    maybeSingle.mockResolvedValue({
      data: {
        id: 'ent-1',
        buyer_user_id: 'buyer-1',
        storage_bucket: 'digital-products-private',
        storage_path: 'buyer-1/file.zip',
        original_filename: 'file.zip',
        download_limit: 1,
        download_count: 0,
        access_status: 'active',
      },
      error: null,
    });
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed-download' },
      error: null,
    });
  });

  it('redeems an entitlement into a signed download url and consumes one download', async () => {
    const { handler } = await import('../netlify/functions/digital-downloads');

    const response = await handler({
      httpMethod: 'POST',
      headers: {
        authorization: 'Bearer token-123',
      },
      body: JSON.stringify({ entitlementId: 'ent-1' }),
    } as any, {} as any);

    expect(response?.statusCode).toBe(200);
    const body = JSON.parse(String(response?.body || '{}'));
    expect(body.ok).toBe(true);
    expect(body.url).toBe('https://example.com/signed-download');
    expect(body.remainingDownloads).toBe(0);
    expect(createSignedUrl).toHaveBeenCalledWith('buyer-1/file.zip', 120, {
      download: 'file.zip',
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        download_count: 1,
        access_status: 'exhausted',
      })
    );
  });
});
