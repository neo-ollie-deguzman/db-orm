import { headers } from "next/headers";

export type TenantContext = {
  tenantId: string;
  name: string;
  slug: string;
  region: string;
};

/**
 * Reads the tenant context injected by the middleware.
 * Call this from server components, API routes, or server actions.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  const name = h.get("x-tenant-name");
  const slug = h.get("x-tenant-slug");
  const region = h.get("x-tenant-region");

  if (!tenantId || !name || !slug || !region) {
    throw new Error("Missing tenant context — is the middleware running?");
  }

  return { tenantId, name, slug, region };
}

/**
 * Convenience shorthand that returns just the tenant ID.
 */
export async function getTenantId(): Promise<string> {
  const { tenantId } = await getTenantContext();
  return tenantId;
}
