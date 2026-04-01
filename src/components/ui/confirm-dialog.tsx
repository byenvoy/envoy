"use client";

import { useRef, useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="mx-4 my-auto max-w-sm rounded-lg border border-border bg-surface p-0 shadow-lg sm:mx-auto backdrop:bg-black/40"
    >
      <div className="p-6">
        <h2 className="text-base font-display font-semibold text-text-primary">
          {title}
        </h2>
        <p className="mt-2 text-sm font-body text-text-secondary">{description}</p>
      </div>
      <div className="flex justify-end gap-2 px-6 pb-6">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`rounded-md px-4 py-2.5 text-sm font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 ${
            variant === "danger"
              ? "bg-error hover:bg-error/90 focus-visible:ring-error"
              : "bg-primary hover:bg-primary-dark focus-visible:ring-primary"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
