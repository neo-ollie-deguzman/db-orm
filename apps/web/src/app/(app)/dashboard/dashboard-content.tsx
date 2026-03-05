"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast, ToastContainer } from "@/components/ui/toast";
import {
  remindersApi,
  meApi,
  ApiError,
  type MeResponse,
} from "@/lib/api-client";
import { Calendar } from "./calendar";
import { CreateReminderDialog, EditReminderDialog } from "./reminder-dialog";
import type { Reminder, ReminderStatus } from "./mock-data";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseMonthParam(param: string | null): {
  year: number;
  month: number;
} {
  if (param) {
    const match = param.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const y = Number(match[1]);
      const m = Number(match[2]) - 1;
      if (m >= 0 && m <= 11 && y >= 1970 && y <= 2100) {
        return { year: y, month: m };
      }
    }
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function formatMonthParam(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function toApiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

const ALL_STATUSES: ReminderStatus[] = ["pending", "completed", "dismissed"];

type UniqueUser = { id: string; name: string; avatarUrl: string | null };

function deriveUniqueUsers(reminders: Reminder[]): UniqueUser[] {
  const map = new Map<string, UniqueUser>();
  for (const r of reminders) {
    if (!map.has(r.userId)) {
      map.set(r.userId, {
        id: r.userId,
        name: r.userName,
        avatarUrl: r.userImage,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function CalendarSkeleton() {
  return (
    <div className="mt-4 animate-pulse rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gray-200" />
          <div className="h-8 w-8 rounded-lg bg-gray-200" />
          <div className="ml-2 h-6 w-40 rounded bg-gray-200" />
        </div>
        <div className="h-8 w-16 rounded-lg bg-gray-200" />
      </div>
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="px-3 py-2">
            <div className="mx-auto h-4 w-8 rounded bg-gray-200" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[110px] border-b border-r border-gray-100 p-2"
          >
            <div className="h-5 w-5 rounded-full bg-gray-100" />
            {i % 3 === 0 && (
              <div className="mt-2 h-4 w-4/5 rounded bg-gray-100" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Error banner ────────────────────────────────────────────────────────────

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 py-16">
      <p className="text-sm font-medium text-red-800">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
      >
        <RefreshIcon />
        Retry
      </button>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toasts, addToast } = useToast();

  // URL params
  const { year, month } = parseMonthParam(searchParams.get("month"));
  const filterUser = searchParams.get("user") ?? "all";
  const filterStatus = searchParams.get("status") ?? "all";

  // Data state
  const [currentUser, setCurrentUser] = useState<MeResponse | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(
    null,
  );

  // ── Derived data ──
  const uniqueUsers = useMemo(() => deriveUniqueUsers(reminders), [reminders]);

  const filteredReminders = useMemo(() => {
    let filtered = reminders;
    if (filterUser !== "all") {
      filtered = filtered.filter((r) => r.userId === filterUser);
    }
    if (filterStatus !== "all") {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }
    return filtered;
  }, [reminders, filterUser, filterStatus]);

  // ── URL navigation helper ──
  const buildUrl = useCallback(
    (overrides: { month?: string; user?: string; status?: string }) => {
      const params = new URLSearchParams();
      const m = overrides.month ?? searchParams.get("month");
      const u = overrides.user ?? filterUser;
      const s = overrides.status ?? filterStatus;
      if (m) params.set("month", m);
      if (u && u !== "all") params.set("user", u);
      if (s && s !== "all") params.set("status", s);
      const qs = params.toString();
      return `/dashboard${qs ? `?${qs}` : ""}`;
    },
    [searchParams, filterUser, filterStatus],
  );

  // ── Fetch current user + reminders ──
  const fetchReminders = useCallback(async () => {
    setFetchError(null);
    setLoading(true);
    try {
      const [me, data] = await Promise.all([meApi.get(), remindersApi.list()]);
      setCurrentUser(me);
      setReminders(data.reminders);
    } catch (err) {
      setFetchError(toApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // ── Month navigation (URL-driven) ──
  function handlePrevMonth() {
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    router.push(buildUrl({ month: formatMonthParam(y, m) }), {
      scroll: false,
    });
  }

  function handleNextMonth() {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    router.push(buildUrl({ month: formatMonthParam(y, m) }), {
      scroll: false,
    });
  }

  function handleToday() {
    const now = new Date();
    router.push(
      buildUrl({ month: formatMonthParam(now.getFullYear(), now.getMonth()) }),
      { scroll: false },
    );
  }

  // ── Filter handlers ──
  function handleUserFilter(value: string) {
    router.push(buildUrl({ user: value }), { scroll: false });
  }

  function handleStatusFilter(value: string) {
    router.push(buildUrl({ status: value }), { scroll: false });
  }

  // ── Day / Reminder clicks ──
  function handleDayClick(date: Date) {
    setSelectedDate(date);
    setCreateOpen(true);
  }

  function handleReminderClick(reminder: Reminder) {
    setSelectedReminder(reminder);
    setEditOpen(true);
  }

  // ── CRUD via API ──
  async function handleCreate(data: {
    note: string;
    reminderDate: string;
    status: ReminderStatus;
  }) {
    try {
      const isoDate = new Date(data.reminderDate).toISOString();
      await remindersApi.create({
        note: data.note,
        reminderDate: isoDate,
        status: data.status,
      });
      setCreateOpen(false);
      addToast("Reminder created");
      await fetchReminders();
    } catch (err) {
      addToast(toApiErrorMessage(err), "error");
      throw err;
    }
  }

  async function handleUpdate(data: {
    id: number;
    note: string;
    reminderDate: string;
    status: ReminderStatus;
  }) {
    try {
      const isoDate = new Date(data.reminderDate).toISOString();
      await remindersApi.update(data.id, {
        note: data.note,
        reminderDate: isoDate,
        status: data.status,
      });
      setEditOpen(false);
      setSelectedReminder(null);
      addToast("Reminder updated");
      await fetchReminders();
    } catch (err) {
      addToast(toApiErrorMessage(err), "error");
      throw err;
    }
  }

  async function handleDelete(id: number) {
    try {
      await remindersApi.delete(id);
      setEditOpen(false);
      setSelectedReminder(null);
      addToast("Reminder deleted");
      await fetchReminders();
    } catch (err) {
      addToast(toApiErrorMessage(err), "error");
      throw err;
    }
  }

  // ── Summary stats (based on filtered set) ──
  const totalThisMonth = filteredReminders.filter((r) => {
    const d = new Date(r.reminderDate);
    return d.getFullYear() === year && d.getMonth() === month;
  }).length;

  const pendingCount = filteredReminders.filter(
    (r) => r.status === "pending",
  ).length;

  const selectClassName =
    "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none";

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reminders</h1>
          {!loading && !fetchError && (
            <p className="mt-1 text-gray-500">
              {totalThisMonth} reminder{totalThisMonth !== 1 ? "s" : ""} this
              month &middot; {pendingCount} pending
            </p>
          )}
          {loading && (
            <div className="mt-2 h-5 w-64 animate-pulse rounded bg-gray-200" />
          )}
        </div>
        <button
          onClick={() => {
            setSelectedDate(new Date());
            setCreateOpen(true);
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          <PlusIcon />
          Add Reminder
        </button>
      </div>

      {/* Filter bar */}
      {!loading && !fetchError && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="filter-user"
              className="text-sm font-medium text-gray-600"
            >
              User
            </label>
            <select
              id="filter-user"
              value={filterUser}
              onChange={(e) => handleUserFilter(e.target.value)}
              className={selectClassName}
            >
              <option value="all">All users</option>
              {uniqueUsers.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.name}
                  {currentUser && u.id === currentUser.id ? " (you)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="filter-status"
              className="text-sm font-medium text-gray-600"
            >
              Status
            </label>
            <select
              id="filter-status"
              value={filterStatus}
              onChange={(e) => handleStatusFilter(e.target.value)}
              className={selectClassName}
            >
              <option value="all">All statuses</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {(filterUser !== "all" || filterStatus !== "all") && (
            <button
              onClick={() => {
                router.push(buildUrl({ user: "all", status: "all" }), {
                  scroll: false,
                });
              }}
              className="text-sm font-medium text-primary hover:text-primary-dark"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Calendar / Loading / Error */}
      {loading && <CalendarSkeleton />}

      {fetchError && !loading && (
        <ErrorBanner message={fetchError} onRetry={fetchReminders} />
      )}

      {!loading && !fetchError && (
        <>
          <div className="mt-4">
            <Calendar
              year={year}
              month={month}
              reminders={filteredReminders}
              currentUserId={currentUser?.id ?? null}
              onReminderClick={handleReminderClick}
              onDayClick={handleDayClick}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onToday={handleToday}
            />
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-100 ring-1 ring-blue-200" />
              Pending
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-green-100 ring-1 ring-green-200" />
              Completed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-gray-200 ring-1 ring-gray-300" />
              Dismissed
            </span>
          </div>
        </>
      )}

      {/* Dialogs */}
      <CreateReminderDialog
        open={createOpen}
        defaultDate={selectedDate}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
      />

      {selectedReminder && (
        <EditReminderDialog
          open={editOpen}
          reminder={selectedReminder}
          currentUserId={currentUser?.id ?? null}
          onClose={() => {
            setEditOpen(false);
            setSelectedReminder(null);
          }}
          onSave={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
