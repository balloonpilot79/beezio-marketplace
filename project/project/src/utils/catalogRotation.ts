// Capture once per page visit so products never jump while someone is browsing.
export const catalogRotationSlot = (now = Date.now()) => Math.floor(now / (15 * 60 * 1000));

// Every product reaches every position over a complete cycle. Sorting by ID
// first makes the cycle independent of API order, titles, prices, or seller size.
export function rotateCatalog<T extends { id: string }>(rows: readonly T[], slot: number): T[] {
  const ordered = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  if (!ordered.length) return ordered;
  const start = ((slot % ordered.length) + ordered.length) % ordered.length;
  return [...ordered.slice(start), ...ordered.slice(0, start)];
}
