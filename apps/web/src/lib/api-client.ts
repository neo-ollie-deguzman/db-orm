import type {
  ReminderResponse,
  RemindersListResponse,
} from "@repo/api-contracts";

export type MeResponse = {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Connection lost. Retrying...");
  }

  if (res.status === 401 || res.status === 403) {
    throw new ApiError(res.status, "You don't have access to this resource");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body?.error || `Request failed (${res.status})`,
      body?.details,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const meApi = {
  get() {
    return request<MeResponse>("/api/me");
  },
};

export const remindersApi = {
  list() {
    return request<RemindersListResponse>("/api/reminders");
  },

  get(id: number) {
    return request<ReminderResponse>(`/api/reminders/${id}`);
  },

  create(data: { note: string; reminderDate: string; status?: string }) {
    return request<ReminderResponse>("/api/reminders", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update(
    id: number,
    data: { note?: string; reminderDate?: string; status?: string },
  ) {
    return request<ReminderResponse>(`/api/reminders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  delete(id: number) {
    return request<void>(`/api/reminders/${id}`, { method: "DELETE" });
  },
};
