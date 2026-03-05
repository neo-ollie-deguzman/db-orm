"use client";

import { useRef, useState, useTransition } from "react";
import { updateUser } from "./actions";

type Props = {
  userId: string;
  currentName: string;
  currentEmail: string;
  currentAvatarUrl: string | null;
  currentLocation: string | null;
};

export function EditUserDialog({
  userId,
  currentName,
  currentEmail,
  currentAvatarUrl,
  currentLocation,
}: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateUser(userId, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <>
      <button
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-blue-50"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Edit User</h2>
            <form
              ref={formRef}
              action={handleSubmit}
              className="mt-4 space-y-4"
            >
              <div>
                <label
                  htmlFor={`name-${userId}`}
                  className="block text-sm font-medium text-gray-700"
                >
                  Name
                </label>
                <input
                  id={`name-${userId}`}
                  name="name"
                  type="text"
                  required
                  defaultValue={currentName}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor={`email-${userId}`}
                  className="block text-sm font-medium text-gray-700"
                >
                  Email
                </label>
                <input
                  id={`email-${userId}`}
                  name="email"
                  type="email"
                  required
                  defaultValue={currentEmail}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor={`avatarUrl-${userId}`}
                  className="block text-sm font-medium text-gray-700"
                >
                  Avatar URL
                </label>
                <input
                  id={`avatarUrl-${userId}`}
                  name="avatarUrl"
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  defaultValue={currentAvatarUrl ?? ""}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor={`location-${userId}`}
                  className="block text-sm font-medium text-gray-700"
                >
                  Location
                </label>
                <input
                  id={`location-${userId}`}
                  name="location"
                  type="text"
                  placeholder="e.g. New York, NY"
                  defaultValue={currentLocation ?? ""}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
