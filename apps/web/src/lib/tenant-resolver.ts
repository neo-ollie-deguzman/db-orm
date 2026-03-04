import { neon, NeonQueryFunction } from "@neondatabase/serverless";

export type ResolvedTenant = {
  id: string;
  name: string;
  slug: string;
  region: string;
};

let _sql: NeonQueryFunction<false, false> | null = null;
function getSql() {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!);
  return _sql;
}

type CacheEntry = {
  tenant: ResolvedTenant | null;
  expiresAt: number;
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

function getCached(key: string): ResolvedTenant | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.tenant;
}

function setCache(key: string, tenant: ResolvedTenant | null) {
  cache.set(key, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Resolves a hostname to a tenant. Works in Edge runtime (uses neon HTTP driver).
 *
 * Resolution order:
 *  1. Subdomain: extract slug from `{slug}.{APP_DOMAIN}` or `{slug}.localhost`
 *  2. Custom domain: look up in tenant_domains where verified
 *
 * Supports an `X-Tenant-Slug` header override for local development.
 */
export async function resolveTenant(
  hostname: string,
  overrideSlug?: string | null,
): Promise<ResolvedTenant | null> {
  const slug = overrideSlug || extractSubdomain(hostname);

  if (slug) {
    const cached = getCached(`slug:${slug}`);
    if (cached !== undefined) return cached;

    const sql = getSql();
    const rows =
      await sql`SELECT id, name, slug, region FROM tenants WHERE slug = ${slug} AND is_active = true LIMIT 1`;

    const tenant =
      rows.length > 0
        ? {
            id: rows[0].id as string,
            name: rows[0].name as string,
            slug: rows[0].slug as string,
            region: rows[0].region as string,
          }
        : null;

    setCache(`slug:${slug}`, tenant);
    return tenant;
  }

  const cached = getCached(`domain:${hostname}`);
  if (cached !== undefined) return cached;

  const sql = getSql();
  const rows = await sql`
    SELECT t.id, t.name, t.slug, t.region
    FROM tenant_domains td
    JOIN tenants t ON t.id = td.tenant_id
    WHERE td.domain = ${hostname} AND td.is_verified = true AND t.is_active = true
    LIMIT 1
  `;

  const tenant =
    rows.length > 0
      ? {
          id: rows[0].id as string,
          name: rows[0].name as string,
          slug: rows[0].slug as string,
          region: rows[0].region as string,
        }
      : null;

  setCache(`domain:${hostname}`, tenant);
  return tenant;
}

function extractSubdomain(hostname: string): string | null {
  const host = hostname.split(":")[0];

  const appDomain = process.env.APP_DOMAIN;
  if (appDomain && host.endsWith(`.${appDomain}`)) {
    const slug = host.slice(0, -(appDomain.length + 1));
    if (slug && !slug.includes(".")) return slug;
  }

  if (host.endsWith(".localhost")) {
    const slug = host.slice(0, -".localhost".length);
    if (slug && !slug.includes(".")) return slug;
  }

  return null;
}
