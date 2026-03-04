#!/usr/bin/env node
/**
 * CI check: contracted API route files must import from @repo/api-contracts.
 * Run from repo root: node scripts/check-contract-usage.mjs
 * Exit 0 if all contracted routes use the contract package; exit 1 otherwise.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** Route files that are part of the API contract (users, reminders). Must import from @repo/api-contracts. */
const CONTRACTED_ROUTES = [
  "apps/web/src/app/api/users/route.ts",
  "apps/web/src/app/api/users/[id]/route.ts",
  "apps/web/src/app/api/reminders/route.ts",
  "apps/web/src/app/api/reminders/[id]/route.ts",
];

const CONTRACT_IMPORT = "@repo/api-contracts";

let failed = false;

for (const rel of CONTRACTED_ROUTES) {
  const path = join(root, rel);
  let content;
  try {
    content = readFileSync(path, "utf-8");
  } catch (err) {
    console.error(`Error reading ${rel}:`, err.message);
    failed = true;
    continue;
  }

  if (!content.includes(CONTRACT_IMPORT)) {
    console.error(
      `[check-contract-usage] ${rel}: must import from "${CONTRACT_IMPORT}"`,
    );
    failed = true;
  }
}

if (failed) {
  console.error(
    "\nContracted API routes must use schemas and types from @repo/api-contracts. See docs/contract-first-agent-guide.md.",
  );
  process.exit(1);
}

console.log(
  "check-contract-usage: all contracted routes use @repo/api-contracts.",
);
