import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-fg-subtle">
        <FileQuestion className="h-7 w-7" aria-hidden="true" />
      </span>
      <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-fg-muted">This item doesn&apos;t exist or may have been deleted.</p>
      <Link href="/" className="btn-primary mt-6">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to library
      </Link>
    </div>
  );
}
