/**
 * Generates openapi.json from contract schemas and registered paths.
 * Run from package root: pnpm run generate:openapi
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import {
  CreateUserBodySchema,
  UpdateUserBodySchema,
  UserResponseSchema,
  UsersListResponseSchema,
} from "../src/schemas/users";
import {
  CreateReminderBodySchema,
  UpdateReminderBodySchema,
  ReminderResponseSchema,
  RemindersListResponseSchema,
} from "../src/schemas/reminders";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

// Register schemas so they appear in components/schemas with refs
registry.register("CreateUserBody", CreateUserBodySchema);
registry.register("UpdateUserBody", UpdateUserBodySchema);
registry.register("UserResponse", UserResponseSchema);
registry.register("UsersListResponse", UsersListResponseSchema);
registry.register("CreateReminderBody", CreateReminderBodySchema);
registry.register("UpdateReminderBody", UpdateReminderBodySchema);
registry.register("ReminderResponse", ReminderResponseSchema);
registry.register("RemindersListResponse", RemindersListResponseSchema);

const idParamSchema = z.object({ id: z.string().describe("Resource ID") });

// --- Users ---
registry.registerPath({
  method: "get",
  path: "/api/users",
  summary: "List users",
  responses: {
    200: {
      description: "List of users",
      content: {
        "application/json": { schema: UsersListResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/users",
  summary: "Create a user",
  request: {
    body: {
      content: {
        "application/json": { schema: CreateUserBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "User created",
      content: {
        "application/json": { schema: UserResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/users/{id}",
  summary: "Get a user by ID",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "User",
      content: {
        "application/json": { schema: UserResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/users/{id}",
  summary: "Update a user",
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": { schema: UpdateUserBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Updated user",
      content: {
        "application/json": { schema: UserResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/users/{id}",
  summary: "Delete a user",
  request: { params: idParamSchema },
  responses: {
    204: { description: "User deleted" },
  },
});

// --- Reminders ---
registry.registerPath({
  method: "get",
  path: "/api/reminders",
  summary: "List reminders",
  responses: {
    200: {
      description: "List of reminders",
      content: {
        "application/json": { schema: RemindersListResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/reminders",
  summary: "Create a reminder",
  request: {
    body: {
      content: {
        "application/json": { schema: CreateReminderBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Reminder created",
      content: {
        "application/json": { schema: ReminderResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/reminders/{id}",
  summary: "Get a reminder by ID",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Reminder",
      content: {
        "application/json": { schema: ReminderResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/reminders/{id}",
  summary: "Update a reminder",
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": { schema: UpdateReminderBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Updated reminder",
      content: {
        "application/json": { schema: ReminderResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/reminders/{id}",
  summary: "Delete a reminder",
  request: { params: idParamSchema },
  responses: {
    204: { description: "Reminder deleted" },
  },
});

// Generate and write
const generator = new OpenApiGeneratorV3(registry.definitions);
const doc = generator.generateDocument({
  openapi: "3.0.0",
  info: {
    title: "API",
    version: "1.0.0",
    description: "Contract-first API; generated from @repo/api-contracts.",
  },
  servers: [{ url: "/", description: "Relative to host" }],
});

const outPath = join(__dirname, "..", "openapi.json");
writeFileSync(outPath, JSON.stringify(doc, null, 2), "utf-8");
console.log("Wrote", outPath);
