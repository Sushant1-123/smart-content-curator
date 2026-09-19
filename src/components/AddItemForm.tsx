"use client";

import { useState, type FormEvent } from "react";

interface AddItemFormProps {
  onSubmit: (url: string) => Promise<{ ok: boolean; message?: string }>;
}

export function AddItemForm({ onSubmit }: AddItemFormProps) {
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const result = await onSubmit(url.trim());

    setIsSubmitting(false);
    if (result.ok) {
      setUrl("");
    } else {
      setError(result.message ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4">
      <label htmlFor="url-input" className="text-sm font-medium text-slate-700">
        Save a link or article
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="url-input"
          type="url"
          required
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/an-interesting-article"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "url-input-error" : undefined}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Saving…" : "Save"}
        </button>
      </div>
      {error && (
        <p id="url-input-error" role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-400">
        We&apos;ll fetch the page, then use AI to generate a summary and tags automatically.
      </p>
    </form>
  );
}
