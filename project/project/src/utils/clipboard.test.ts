import { afterEach, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from './clipboard';
afterEach(() => vi.unstubAllGlobals());
it('falls back to selection and copy when clipboard permission is denied', async () => {
  const textarea = { value: '', style: {}, setAttribute: vi.fn(), focus: vi.fn(), select: vi.fn(), setSelectionRange: vi.fn() };
  const removeChild = vi.fn();
  const execCommand = vi.fn().mockReturnValue(true);
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
  vi.stubGlobal('document', { createElement: () => textarea, body: { appendChild: vi.fn(), removeChild }, execCommand });
  expect(await copyTextToClipboard('https://beezio.co/product/p1?ref=partner')).toBe(true);
  expect(textarea.value).toContain('ref=partner');
  expect(textarea.select).toHaveBeenCalled();
  expect(execCommand).toHaveBeenCalledWith('copy');
  expect(removeChild).toHaveBeenCalledWith(textarea);
});
