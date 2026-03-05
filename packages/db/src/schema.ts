import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const reminderStatusEnum = pgEnum("reminder_status", [
  "pending",
  "completed",
  "dismissed",
]);

export const tenantPlanEnum = pgEnum("tenant_plan", [
  "free",
  "pro",
  "enterprise",
]);

export const domainTypeEnum = pgEnum("domain_type", ["subdomain", "custom"]);

export const tenantRoleEnum = pgEnum("tenant_role", [
  "owner",
  "admin",
  "member",
]);

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  region: text("region").default("us-east-1").notNull(),
  plan: tenantPlanEnum("plan").default("free").notNull(),
  settings: jsonb("settings"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tenantsRelations = relations(tenants, ({ many }) => ({
  domains: many(tenantDomains),
  memberships: many(tenantMemberships),
  users: many(users),
  reminders: many(reminders),
}));

// ---------------------------------------------------------------------------
// Tenant Domains
// ---------------------------------------------------------------------------

export const tenantDomains = pgTable(
  "tenant_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    domain: text("domain").unique().notNull(),
    type: domainTypeEnum("type").notNull(),
    isVerified: boolean("is_verified").default(false).notNull(),
    verificationToken: text("verification_token"),
    verifiedAt: timestamp("verified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_tenant_domains_tenant_id").on(table.tenantId)],
);

export const tenantDomainsRelations = relations(tenantDomains, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantDomains.tenantId],
    references: [tenants.id],
  }),
}));

// ---------------------------------------------------------------------------
// Tenant Memberships
// ---------------------------------------------------------------------------

export const tenantMemberships = pgTable(
  "tenant_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: tenantRoleEnum("role").default("member").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("uq_tenant_memberships_tenant_user").on(
      table.tenantId,
      table.userId,
    ),
    index("idx_tenant_memberships_tenant_id").on(table.tenantId),
    index("idx_tenant_memberships_user_id").on(table.userId),
  ],
);

export const tenantMembershipsRelations = relations(
  tenantMemberships,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [tenantMemberships.tenantId],
      references: [tenants.id],
    }),
    user: one(users, {
      fields: [tenantMemberships.userId],
      references: [users.id],
    }),
  }),
);

// ---------------------------------------------------------------------------
// Users (BetterAuth "user" model + app-specific fields)
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("avatar_url"),
    location: text("location"),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    unique("uq_users_tenant_email").on(table.tenantId, table.email),
    index("idx_users_tenant_id").on(table.tenantId),
    pgPolicy("tenant_isolation_users", {
      as: "permissive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id')::uuid`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id')::uuid`,
    }),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  sessions: many(sessions),
  accounts: many(accounts),
  reminders: many(reminders),
  memberships: many(tenantMemberships),
}));

// ---------------------------------------------------------------------------
// Sessions (BetterAuth session management)
// ---------------------------------------------------------------------------

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_sessions_user_id").on(table.userId),
    index("idx_sessions_token").on(table.token),
  ],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// ---------------------------------------------------------------------------
// Accounts (BetterAuth credential & OAuth providers)
// ---------------------------------------------------------------------------

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_accounts_user_id").on(table.userId)],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

// ---------------------------------------------------------------------------
// Verifications (BetterAuth email verification, magic links, etc.)
// ---------------------------------------------------------------------------

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Two-Factor secrets (BetterAuth two-factor plugin)
// ---------------------------------------------------------------------------

export const twoFactors = pgTable("two_factors", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const twoFactorsRelations = relations(twoFactors, ({ one }) => ({
  user: one(users, {
    fields: [twoFactors.userId],
    references: [users.id],
  }),
}));

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export const reminders = pgTable(
  "reminders",
  {
    id: serial("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    note: text("note").notNull(),
    status: reminderStatusEnum("status").default("pending").notNull(),
    reminderDate: timestamp("reminder_date").notNull(),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("idx_reminders_user_id").on(table.userId),
    index("idx_reminders_reminder_date").on(table.reminderDate),
    index("idx_reminders_tenant_id").on(table.tenantId),
    index("idx_reminders_tenant_user_active").on(
      table.tenantId,
      table.userId,
      table.isDeleted,
      table.reminderDate,
    ),
    pgPolicy("tenant_isolation_reminders", {
      as: "permissive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id')::uuid`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id')::uuid`,
    }),
  ],
);

export const remindersRelations = relations(reminders, ({ one }) => ({
  tenant: one(tenants, {
    fields: [reminders.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [reminders.userId],
    references: [users.id],
  }),
}));
