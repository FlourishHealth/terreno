/**
 * Cursor ordering for sync streams. Cursors are opaque strings, but the delta
 * protocol assigns monotonic integer sequence numbers; compare numerically when
 * both sides parse as finite numbers (so "10" > "9"), falling back to
 * lexicographic order for non-numeric cursors.
 */
export const isCursorAfter = (candidate: string, current: string): boolean => {
  const candidateNum = Number(candidate);
  const currentNum = Number(current);
  if (Number.isFinite(candidateNum) && Number.isFinite(currentNum)) {
    return candidateNum > currentNum;
  }
  return candidate.localeCompare(current) > 0;
};

/**
 * Canonical stream id for a collection. Owner-scoped collections use
 * `${collection}:${ownerId}` so each user has an independent cursor space
 * (matching the delta-transport plan); without an owner it is just the
 * collection name.
 */
export const streamForCollection = ({
  collection,
  ownerId,
}: {
  collection: string;
  ownerId?: string;
}): string => (ownerId ? `${collection}:${ownerId}` : collection);
