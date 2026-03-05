"use server";

import * as core from "@repo/core";
import { revalidatePath } from "next/cache";
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
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const avatarUrl = (formData.get("avatarUrl") as string) || null;
  const location = (formData.get("location") as string) || null;

  if (!name || !email) {
    return { error: "Name and email are required." };
  }

  try {
    const tenantId = await getTenantId();
    await core.updateUser(tenantId, id, {
      name,
      email,
      image: avatarUrl,
      location,
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
