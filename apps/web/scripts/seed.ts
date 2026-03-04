import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import ws from "ws";
import {
  reminders,
  schema,
  tenantDomains,
  tenantMemberships,
  tenants,
  users,
} from "@repo/db";

neonConfig.webSocketConstructor = ws;

const DEFAULT_PASSWORD = "passworD123";

const REMINDER_NOTES = [
  "Submit quarterly report",
  "Schedule dentist appointment",
  "Review pull request #42",
  "Buy groceries for the week",
  "Call mom for her birthday",
  "Renew gym membership",
  "Prepare slides for team standup",
  "Follow up with client about proposal",
  "Pay electricity bill",
  "Book flight for conference",
  "Update project dependencies",
  "Send invoice to accounting",
  "Pick up dry cleaning",
  "Write blog post draft",
  "Backup laptop to external drive",
  "Order new office chair",
  "Review insurance policy",
  "Set up 1-on-1 with manager",
  "Return library books",
  "Clean out garage",
  "Schedule car oil change",
  "Complete online training module",
  "Water the plants",
  "Organize desktop files",
  "Respond to survey from HR",
];

function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });

  // Temporarily disable FORCE RLS so the seed can write without tenant context
  const admin = await pool.connect();
  await admin.query("ALTER TABLE users DISABLE ROW LEVEL SECURITY");
  await admin.query("ALTER TABLE reminders DISABLE ROW LEVEL SECURITY");
  admin.release();

  const db = drizzle({ client: pool, schema });

  // --- Tenants ---
  const seedTenants = [
    { name: "Acme Corp", slug: "acme", region: "us-east-1" },
    { name: "Globex Inc", slug: "globex", region: "eu-west-1" },
    { name: "Initech Systems", slug: "initech", region: "us-east-1" },
  ] as const;

  console.log("Seeding tenants...");
  const insertedTenants = await db
    .insert(tenants)
    .values(
      seedTenants.map((t) => ({
        name: t.name,
        slug: t.slug,
        region: t.region,
      })),
    )
    .onConflictDoNothing({ target: tenants.slug })
    .returning();

  const allTenants =
    insertedTenants.length > 0
      ? insertedTenants
      : await db.select().from(tenants);

  console.log(`Using ${allTenants.length} tenants.`);

  // --- Tenant Domains ---
  console.log("Seeding tenant domains...");
  for (const tenant of allTenants) {
    await db
      .insert(tenantDomains)
      .values({
        tenantId: tenant.id,
        domain: `${tenant.slug}.localhost`,
        type: "subdomain",
        isVerified: true,
        verifiedAt: new Date(),
      })
      .onConflictDoNothing({ target: tenantDomains.domain });
  }

  // --- Users ---
  const acmeTenant = allTenants.find((t) => t.slug === "acme") ?? allTenants[0];
  const globexTenant =
    allTenants.find((t) => t.slug === "globex") ??
    allTenants[1] ??
    allTenants[0];
  const initechTenant =
    allTenants.find((t) => t.slug === "initech") ??
    allTenants[2] ??
    allTenants[0];

  console.log("Hashing default password...");
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const seedUsers = [
    {
      name: "Alice Johnson",
      email: "alice.johnson@example.com",
      location: "New York, NY",
      avatarUrl: "https://i.pravatar.cc/150?u=alice",
      tenantId: acmeTenant.id,
      passwordHash,
    },
    {
      name: "Bob Smith",
      email: "bob.smith@example.com",
      location: "San Francisco, CA",
      avatarUrl: "https://i.pravatar.cc/150?u=bob",
      tenantId: acmeTenant.id,
      passwordHash,
    },
    {
      name: "Carol Williams",
      email: "carol.williams@example.com",
      location: "Chicago, IL",
      avatarUrl: "https://i.pravatar.cc/150?u=carol",
      tenantId: acmeTenant.id,
      passwordHash,
    },
    {
      name: "David Brown",
      email: "david.brown@example.com",
      location: "Austin, TX",
      avatarUrl: null,
      tenantId: acmeTenant.id,
      passwordHash,
    },
    {
      name: "Eva Martinez",
      email: "eva.martinez@example.com",
      location: "Miami, FL",
      avatarUrl: "https://i.pravatar.cc/150?u=eva",
      tenantId: acmeTenant.id,
      passwordHash,
    },
    {
      name: "Frank Lee",
      email: "frank.lee@example.com",
      location: "Seattle, WA",
      avatarUrl: null,
      tenantId: globexTenant.id,
      passwordHash,
    },
    {
      name: "Grace Kim",
      email: "grace.kim@example.com",
      location: "Boston, MA",
      avatarUrl: "https://i.pravatar.cc/150?u=grace",
      tenantId: globexTenant.id,
      passwordHash,
    },
    {
      name: "Henry Davis",
      email: "henry.davis@example.com",
      location: "Denver, CO",
      avatarUrl: "https://i.pravatar.cc/150?u=henry",
      tenantId: globexTenant.id,
      passwordHash,
    },
    {
      name: "Iris Chen",
      email: "iris.chen@example.com",
      location: "Los Angeles, CA",
      avatarUrl: null,
      tenantId: globexTenant.id,
      passwordHash,
    },
    {
      name: "Jack Wilson",
      email: "jack.wilson@example.com",
      location: "Portland, OR",
      avatarUrl: "https://i.pravatar.cc/150?u=jack",
      tenantId: globexTenant.id,
      passwordHash,
    },
    {
      name: "Liam Patel",
      email: "liam.patel@example.com",
      location: "Dallas, TX",
      avatarUrl: "https://i.pravatar.cc/150?u=liam",
      tenantId: initechTenant.id,
      passwordHash,
    },
    {
      name: "Mia Thompson",
      email: "mia.thompson@example.com",
      location: "Atlanta, GA",
      avatarUrl: "https://i.pravatar.cc/150?u=mia",
      tenantId: initechTenant.id,
      passwordHash,
    },
    {
      name: "Noah Garcia",
      email: "noah.garcia@example.com",
      location: "Phoenix, AZ",
      avatarUrl: null,
      tenantId: initechTenant.id,
      passwordHash,
    },
    {
      name: "Olivia Nguyen",
      email: "olivia.nguyen@example.com",
      location: "Minneapolis, MN",
      avatarUrl: "https://i.pravatar.cc/150?u=olivia",
      tenantId: initechTenant.id,
      passwordHash,
    },
    {
      name: "Peter Müller",
      email: "peter.muller@example.com",
      location: "Nashville, TN",
      avatarUrl: null,
      tenantId: initechTenant.id,
      passwordHash,
    },
  ];

  console.log("Seeding users...");
  const insertedUsers = await db
    .insert(users)
    .values(seedUsers)
    .onConflictDoNothing()
    .returning();

  const allUsers =
    insertedUsers.length > 0
      ? insertedUsers
      : await db.select().from(users).where(eq(users.isDeleted, false));
  const userIds = allUsers.map((u) => u.id);
  console.log(`Using ${userIds.length} user IDs for reminders.`);

  // --- Tenant Memberships ---
  console.log("Seeding tenant memberships...");
  for (const user of allUsers) {
    await db
      .insert(tenantMemberships)
      .values({
        tenantId: user.tenantId,
        userId: user.id,
        role:
          user.email.includes("alice") ||
          user.email.includes("frank") ||
          user.email.includes("liam")
            ? "owner"
            : "member",
      })
      .onConflictDoNothing();
  }

  // --- Reminders ---
  await db.delete(reminders);

  const febStart = new Date("2026-02-01T00:00:00");
  const marEnd = new Date("2026-03-31T23:59:59");
  const statuses: ("pending" | "completed" | "dismissed")[] = [
    "pending",
    "completed",
    "dismissed",
  ];

  const acmeGlobexUsers = allUsers.filter(
    (u) => u.tenantId !== initechTenant.id,
  );
  const initechUsers = allUsers.filter((u) => u.tenantId === initechTenant.id);

  const seedReminders = [
    ...Array.from({ length: 50 }, () => {
      const user = pickRandom(acmeGlobexUsers);
      return {
        tenantId: user.tenantId,
        userId: user.id,
        note: pickRandom(REMINDER_NOTES),
        status: pickRandom(statuses),
        reminderDate: randomDate(febStart, marEnd),
      };
    }),
    ...Array.from({ length: 20 }, () => {
      const user = pickRandom(initechUsers);
      return {
        tenantId: user.tenantId,
        userId: user.id,
        note: pickRandom(REMINDER_NOTES),
        status: pickRandom(statuses),
        reminderDate: randomDate(febStart, marEnd),
      };
    }),
  ];

  console.log("Seeding 70 reminders...");
  await db.insert(reminders).values(seedReminders);

  // Re-enable RLS
  const adminPost = await pool.connect();
  await adminPost.query("ALTER TABLE users ENABLE ROW LEVEL SECURITY");
  await adminPost.query("ALTER TABLE users FORCE ROW LEVEL SECURITY");
  await adminPost.query("ALTER TABLE reminders ENABLE ROW LEVEL SECURITY");
  await adminPost.query("ALTER TABLE reminders FORCE ROW LEVEL SECURITY");
  adminPost.release();

  console.log("Seeding complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
