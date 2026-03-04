"use client";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
};

export function Modal({
  open,
  onClose,
  children,
  maxWidth = "max-w-md",
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`relative w-full ${maxWidth} rounded-xl border border-gray-200 bg-white p-6 shadow-xl`}
      >
        {children}
      </div>
    </div>
  );
}
