"use client";

import { RotateCw } from "lucide-react";

/** Inline alert for a failed list fetch, with a retry button. */
export function ListError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-soft-fg">
      <span>{message}</span>
      <button type="button" onClick={onRetry} className="btn-secondary py-1.5">
        <RotateCw className="h-4 w-4" aria-hidden="true" /> Try again
      </button>
    </div>
  );
}
