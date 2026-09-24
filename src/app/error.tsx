"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCw } from "lucide-react";

/** Error state for any page whose server render failed (e.g. the database is unreachable). */
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <AlertTriangle className="h-7 w-7" aria-hidden="true" />
      </span>
      <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight">Couldn&apos;t load this page</h1>
      <p className="mt-2 text-fg-muted">Your saved items are safe. Check your connection and try again.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className="btn-primary">
          <RotateCw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
        <Link href="/" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </Link>
      </div>
    </div>
  );
}
