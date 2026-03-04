import { sql } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { db } from "./client";
import type * as schema from "./schema";

type TenantDb = NeonDatabase<typeof schema>;
type TransactionClient = Parameters<Parameters<TenantDb["transaction"]>[0]>[0];

/**
 * Executes a callback within a transaction that has RLS tenant context set.
 * All queries inside the callback are automatically scoped to the given tenant
 * via PostgreSQL's `current_setting('app.current_tenant_id')`.
 */
export async function withTenant<T>(
  tenantId: string,
  callback: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE app_user`);
    await tx.execute(
      sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
    );
    return callback(tx);
  });
}
