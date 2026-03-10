import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { magicLink } from "better-auth/plugins";
import bcrypt from "bcryptjs";
import { db, schema } from "@repo/db";

const envBaseUrl = process.env.BETTER_AUTH_URL?.trim();
const baseURL = envBaseUrl || "http://localhost:3000";

const envSecret = process.env.BETTER_AUTH_SECRET?.trim();
const isProductionRuntime =
  process.env.NODE_ENV === "production" && !process.env.CI;
const secret =
  envSecret ||
  (isProductionRuntime ? undefined : "dev-secret-min-32-chars-change-in-prod");

if (isProductionRuntime && !secret) {
  throw new Error(
    "BETTER_AUTH_SECRET is required in production. Set the environment variable before starting.",
  );
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: false,
    schema: {
      ...schema,
      user: schema.users,
      // Workaround for better-auth/better-auth#3069: core sometimes passes "userss" to the adapter.
      // Remove once upstream is fixed.
      userss: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      twoFactor: schema.twoFactors,
    },
  }),

  appName: "DB ORM POC",
  baseURL,
  secret,

  emailAndPassword: {
    enabled: true,
    // Match seed script: passwords are hashed with bcrypt (rounds 10)
    password: {
      hash: async (password) => bcrypt.hash(password, 10),
      verify: async ({ password, hash }) => bcrypt.compare(password, hash),
    },
  },

  plugins: [
    twoFactor({
      issuer: "DB ORM POC",
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        if (process.env.NODE_ENV !== "production") {
          console.log(`[Magic Link] Send to ${email}: ${url}`);
        } else {
          console.log(`[Magic Link] Sent to ${email}`);
        }
      },
    }),
  ],

  user: {
    modelName: "user",
    additionalFields: {
      tenantId: {
        type: "string",
        required: true,
        input: true,
        fieldName: "tenantId",
      },
      location: {
        type: "string",
        required: false,
      },
      isDeleted: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },

  session: {
    modelName: "session",
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
  },

  account: {
    modelName: "account",
  },

  verification: {
    modelName: "verification",
  },

  trustedOrigins: [
    "http://localhost:3000",
    "http://acme.localhost:3000",
    "http://globex.localhost:3000",
    "http://initech.localhost:3000",
    "http://*.localhost:3000",
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
