"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import type { Reminder, ReminderStatus } from "./mock-data";

const STATUS_OPTIONS: { value: ReminderStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "dismissed", label: "Dismissed" },
];

const STATUS_BADGE: Record<ReminderStatus, string> = {
  pending: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  dismissed: "bg-gray-100 text-gray-600",
};

function toLocalDatetimeString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

// ─── Create Dialog ───────────────────────────────────────────────────────────

type CreateProps = {
  open: boolean;
  defaultDate: Date;
  onClose: () => void;
  onSave: (data: {
    note: string;
    reminderDate: string;
    status: ReminderStatus;
  }) => Promise<void>;
};

export function CreateReminderDialog({
  open,
  defaultDate,
  onClose,
  onSave,
}: CreateProps) {
  const [note, setNote] = useState("");
  const [date, setDate] = useState(toLocalDatetimeString(defaultDate));
  const [status, setStatus] = useState<ReminderStatus>("pending");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) {
      setError("Note is required.");
      return;
    }
    if (!date) {
      setError("Date is required.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({ note: note.trim(), reminderDate: date, status });
      setNote("");
      setStatus("pending");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create reminder.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-lg font-semibold">New Reminder</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Field label="Note">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            placeholder="What do you need to remember?"
          />
        </Field>

        <Field label="Date & Time">
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </Field>

        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ReminderStatus)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {saving && <Spinner />}
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Avatar helper ───────────────────────────────────────────────────────────

function UserAvatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl: string | null;
  size?: "md" | "lg";
}) {
  const px = size === "lg" ? "h-10 w-10" : "h-7 w-7";
  const text = size === "lg" ? "text-sm" : "text-[10px]";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${px} shrink-0 rounded-full object-cover`}
      />
    );
  }

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      className={`${px} ${text} flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary`}
    >
      {initials}
    </span>
  );
}

// ─── Edit / Delete Dialog ────────────────────────────────────────────────────

type EditProps = {
  open: boolean;
  reminder: Reminder;
  currentUserId: string | null;
  onClose: () => void;
  onSave: (data: {
    id: number;
    note: string;
    reminderDate: string;
    status: ReminderStatus;
  }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
};

export function EditReminderDialog({
  open,
  reminder,
  currentUserId,
  onClose,
  onSave,
  onDelete,
}: EditProps) {
  const [note, setNote] = useState(reminder.note);
  const [date, setDate] = useState(
    toLocalDatetimeString(new Date(reminder.reminderDate)),
  );
  const [status, setStatus] = useState<ReminderStatus>(reminder.status);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentUserId !== null && reminder.userId === currentUserId;
  const busy = saving || deleting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwner) return;
    if (!note.trim()) {
      setError("Note is required.");
      return;
    }
    if (!date) {
      setError("Date is required.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        id: reminder.id,
        note: note.trim(),
        reminderDate: date,
        status,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save reminder.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isOwner) return;
    setDeleting(true);
    try {
      await onDelete(reminder.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete reminder.",
      );
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  if (confirmDelete) {
    return (
      <Modal
        open={open}
        onClose={() => setConfirmDelete(false)}
        maxWidth="max-w-sm"
      >
        <h2 className="text-lg font-semibold">Delete Reminder</h2>
        <p className="mt-2 text-sm text-gray-500">
          Are you sure you want to delete{" "}
          <span className="font-medium text-gray-900">
            &ldquo;{reminder.note}&rdquo;
          </span>
          ? This cannot be undone.
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            disabled={deleting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {deleting && <Spinner />}
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>
    );
  }

  const inputClassName = isOwner
    ? "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
    : "mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500";

  return (
    <Modal open={open} onClose={onClose}>
      {/* Header with avatar, name, and status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserAvatar
            name={reminder.userName}
            avatarUrl={reminder.userImage}
            size="lg"
          />
          <div>
            <h2 className="text-lg font-semibold leading-tight">
              {isOwner ? "Edit Reminder" : "View Reminder"}
            </h2>
            <p className="text-sm text-gray-500">{reminder.userName}</p>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[reminder.status]}`}
        >
          {reminder.status}
        </span>
      </div>

      {!isOwner && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          This reminder belongs to {reminder.userName}. Only the owner can edit
          or delete it.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Field label="Note">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            disabled={!isOwner}
            className={inputClassName}
          />
        </Field>

        <Field label="Date & Time">
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={!isOwner}
            className={inputClassName}
          />
        </Field>

        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ReminderStatus)}
            disabled={!isOwner}
            className={inputClassName}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {isOwner ? (
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                {saving && <Spinner />}
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
