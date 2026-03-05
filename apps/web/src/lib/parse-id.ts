/**
 * Parse a string route parameter into a positive integer ID.
 * Returns null if the value is not a valid positive integer.
 */
export function parseId(id: string): number | null {
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
