import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { requireRecruitInviter } from './RecruitInviteNotice';

const code = 'BZO-demo';
const fetchInvite = vi.fn();

beforeEach(() => {
  fetchInvite.mockReset();
  vi.stubGlobal('fetch', fetchInvite);
  vi.stubGlobal('window', { setTimeout, clearTimeout });
});
afterEach(() => vi.unstubAllGlobals());

it('passes the validated inviter to signup without making a second request', async () => {
  await expect(requireRecruitInviter({ code, status: 'accepted', referrerProfileId: 'owner' })).resolves.toBe('owner');
  expect(fetchInvite).not.toHaveBeenCalled();
});

it('retries an unavailable lookup before allowing a referred signup', async () => {
  fetchInvite.mockResolvedValueOnce(new Response(null, { status: 503 }));
  await expect(requireRecruitInviter({ code, status: 'error' })).rejects.toThrow('Try again');
  fetchInvite.mockResolvedValueOnce(Response.json({ ok: true, valid: true, referrerProfileId: 'owner' }));
  await expect(requireRecruitInviter({ code, status: 'error' })).resolves.toBe('owner');
});

it('rejects an invalid invite rather than silently dropping the referrer', async () => {
  await expect(requireRecruitInviter({ code, status: 'invalid' })).rejects.toThrow('working link');
  expect(fetchInvite).not.toHaveBeenCalled();
});

it('leaves ordinary signup independent of the resolver', async () => {
  await expect(requireRecruitInviter(null)).resolves.toBe('');
  expect(fetchInvite).not.toHaveBeenCalled();
});
