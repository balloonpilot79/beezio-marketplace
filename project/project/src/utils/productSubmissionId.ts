import { v4 as uuidv4 } from 'uuid';

export const resolveStableProductSubmissionId = (
  currentId: string | null | undefined,
  generateId: () => string = uuidv4
): string => {
  const existing = String(currentId || '').trim();
  return existing || generateId();
};
