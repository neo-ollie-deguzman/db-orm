"use server";

import * as core from "@repo/core";
import { revalidatePath } from "next/cache";
import { hashPassword } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";

export async function getUsers() {
  const tenantId = await getTenantId();
  return core.listUsers(tenantId);
}

export async function createUser(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const avatarUrl = (formData.get("avatarUrl") as string) || null;
  const location = (formData.get("location") as string) || null;

  if (!name || !email) {
    return { error: "Name and email are required." };
  }

  try {
    const tenantId = await getTenantId();
    const passwordHash = await hashPassword("passworD123");
    await core.createUser(
      tenantId,
      { name, email, avatarUrl, location },
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
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const avatarUrl = (formData.get("avatarUrl") as string) || null;
  const location = (formData.get("location") as string) || null;

  if (!name || !email) {
    return { error: "Name and email are required." };
  }

  try {
    const tenantId = await getTenantId();
    await core.updateUser(tenantId, id, { name, email, avatarUrl, location });
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
