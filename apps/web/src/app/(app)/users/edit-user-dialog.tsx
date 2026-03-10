"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, Save, X as XIcon } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { updateUser } from "./actions";

type Props = {
  userId: string;
  currentName: string;
  currentEmail: string;
  currentImage: string | null;
  currentLocation: string | null;
};

export function EditUserDialog({
  userId,
  currentName,
  currentEmail,
  currentImage,
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
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-blue-50"
      >
        <Pencil size={14} />
        Edit
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <h2 className="text-lg font-semibold">Edit User</h2>
        <form ref={formRef} action={handleSubmit} className="mt-4 space-y-4">
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
              defaultValue={currentImage ?? ""}
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <XIcon size={14} />
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {isPending ? <Spinner /> : <Save size={16} />}
              {isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
