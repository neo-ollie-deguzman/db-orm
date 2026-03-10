"use server";

import * as core from "@repo/core";
import {
  CreateUserBodySchema,
  UpdateUserBodySchema,
} from "@repo/api-contracts";
import { revalidatePath } from "next/cache";
import { getTenantId } from "@/lib/tenant";

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
    await core.createUser(tenantId, {
      name,
      email,
      image: avatarUrl,
      location,
    });
  } catch (e) {
    if (e instanceof core.CoreConflictError) {
      return { error: "A user with that email already exists." };
    }
    console.error("[users/actions:createUser]", e);
    return { error: "Internal server error." };
  }

  revalidatePath("/users");
  return { success: true };
}

export async function updateUser(id: string, formData: FormData) {
  const raw = {
    name: formData.get("name") ?? undefined,
    email: formData.get("email") ?? undefined,
    avatarUrl: formData.get("avatarUrl") || undefined,
    location: formData.get("location") || undefined,
  };

  const defined = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined && v !== ""),
  );
  if (Object.keys(defined).length === 0) {
    return { error: "No fields to update." };
  }

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
      ...(avatarUrl !== undefined && { image: avatarUrl }),
      ...(location !== undefined && { location }),
    });
  } catch (e) {
    if (e instanceof core.CoreNotFoundError) {
      return { error: "User not found." };
    }
    if (e instanceof core.CoreConflictError) {
      return { error: "A user with that email already exists." };
    }
    console.error("[users/actions:updateUser]", e);
    return { error: "Internal server error." };
  }

  revalidatePath("/users");
  return { success: true };
}

export async function deleteUser(id: string) {
  try {
    const tenantId = await getTenantId();
    await core.deleteUser(tenantId, id);
  } catch (e) {
    if (e instanceof core.CoreNotFoundError) {
      return { error: "User not found." };
    }
    console.error("[users/actions:deleteUser]", e);
    return { error: "Internal server error." };
  }

  revalidatePath("/users");
  return { success: true };
}
