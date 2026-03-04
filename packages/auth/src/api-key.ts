/**
 * API key validation: lookup key → tenant (and optionally scopes).
 * Stub for Phase 3; implement when adding programmatic API access (e.g. lookup in DB or cache).
 */

export interface ApiKeyContext {
  tenantId: string;
  scopes?: string[];
}

/**
 * Validates an API key and returns tenant context.
 * Returns null if key is invalid or not found.
 * TODO: Implement lookup (e.g. api_keys table or cache) when adding programmatic API access.
 */
export async function validateApiKey(
  _key: string,
): Promise<ApiKeyContext | null> {
  return null;
}
