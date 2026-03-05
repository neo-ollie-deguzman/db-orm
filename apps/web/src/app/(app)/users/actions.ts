"use server";

import * as core from "@repo/core";
import {
  CreateUserBodySchema,
  UpdateUserBodySchema,
} from "@repo/api-contracts";
import { revalidatePath } from "next/cache";
import { hashPassword } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import crypto from "node:crypto";

export async function getUsers() {
  const tenantId = await getTenantId();
  return core.listUsers(tenantId);
}

export async function createUser(formData: FormData) {
  const raw = {
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    avatarUrl: formData.get("avatarUrl") || undefined,
    location: formData.get("location") || undefined,
  };

  const parsed = CreateUserBodySchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const message =
      Object.values(fieldErrors).flat().join(". ") || "Validation failed";
    return { error: message };
  }

  const { name, email, avatarUrl, location } = parsed.data;

  try {
    const tenantId = await getTenantId();
    const temporaryPassword = crypto.randomBytes(16).toString("hex");
    const passwordHash = await hashPassword(temporaryPassword);
    await core.createUser(
      tenantId,
      { name, email, avatarUrl: avatarUrl ?? null, location: location ?? null },
      passwordHash,
    );
  } catch (e) {
    if (e instanceof core.CoreConflictError) {
      return { error: "A user with that email already exists." };
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    return { error: message };
  }

  revalidatePath("/users");
  return { success: true };
}

export async function updateUser(id: number, formData: FormData) {
  const raw = {
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    avatarUrl: formData.get("avatarUrl") || undefined,
    location: formData.get("location") || undefined,
  };

  const parsed = UpdateUserBodySchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const message =
      Object.values(fieldErrors).flat().join(". ") || "Validation failed";
    return { error: message };
  }

  const { name, email, avatarUrl, location } = parsed.data;

  try {
    const tenantId = await getTenantId();
    await core.updateUser(tenantId, id, {
      name,
      email,
      avatarUrl: avatarUrl ?? null,
      location: location ?? null,
    });
  } catch (e) {
    if (e instanceof core.CoreNotFoundError) {
      return { error: "User not found." };
    }
    if (e instanceof core.CoreConflictError) {
      return { error: "A user with that email already exists." };
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    return { error: message };
  }

  revalidatePath("/users");
  return { success: true };
}

export async function deleteUser(id: number) {
  try {
    const tenantId = await getTenantId();
    await core.deleteUser(tenantId, id);
  } catch (e) {
    if (e instanceof core.CoreNotFoundError) {
      return { error: "User not found." };
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    return { error: message };
  }

  revalidatePath("/users");
  return { success: true };
}
