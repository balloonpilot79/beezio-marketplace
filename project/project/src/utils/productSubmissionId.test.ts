import { describe, expect, it, vi } from 'vitest';
import { resolveStableProductSubmissionId } from './productSubmissionId';

describe('stable product submission id', () => {
  it('reuses the same id when a save is retried', () => {
    const generateId = vi.fn(() => 'new-id');

    expect(resolveStableProductSubmissionId('existing-id', generateId)).toBe('existing-id');
    expect(generateId).not.toHaveBeenCalled();
  });

  it('generates an id for the first save attempt', () => {
    const generateId = vi.fn(() => 'new-id');

    expect(resolveStableProductSubmissionId(null, generateId)).toBe('new-id');
    expect(generateId).toHaveBeenCalledOnce();
  });
});
