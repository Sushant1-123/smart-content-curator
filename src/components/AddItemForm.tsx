"use client";

import { forwardRef, useState, type FormEvent } from "react";
import { ArrowRight, Link2, Loader2 } from "lucide-react";
import { CreateItemRequestSchema } from "@/types/api";
import { withProtocol } from "@/lib/format";

interface AddItemFormProps {
  /** Starts a save. Resolves once the request settles; errors are surfaced by the caller via toasts. */
  onSave: (url: string) => void;
  savingCount: number;
}

/** Prominent "save a link" input. Accepts bare domains ("example.com/post") by adding https://. */
export const AddItemForm = forwardRef<HTMLInputElement, AddItemFormProps>(function AddItemForm(
  { onSave, savingCount },
  ref,
) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const candidate = withProtocol(value);
    const parsed = CreateItemRequestSchema.safeParse({ url: candidate });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Enter a valid URL");
      return;
    }
    setError(null);
    setValue("");
    onSave(parsed.data.url);
  }

  const isSaving = savingCount > 0;

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Save a link" className="w-full">
      <label htmlFor="save-url" className="sr-only">
        Link to save
      </label>
      <div
        className={`card flex flex-col gap-2 p-2 transition-shadow focus-within:shadow-card-hover focus-within:ring-2 sm:flex-row sm:items-center ${
          error ? "ring-2 ring-danger/40" : "focus-within:ring-accent/30"
        }`}
      >
        <div className="flex flex-1 items-center gap-3 px-3">
          <Link2 className="h-5 w-5 shrink-0 text-fg-subtle" aria-hidden="true" />
          <input
            ref={ref}
            id="save-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Paste a link to an article, post or page…"
            className="h-12 w-full min-w-0 bg-transparent text-base text-fg placeholder:text-fg-subtle focus:outline-none"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "save-url-error" : "save-url-hint"}
          />
        </div>
        <button type="submit" className="btn-primary h-12 px-5 text-base sm:h-11">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          )}
          Save link
        </button>
      </div>
      {error ? (
        <p id="save-url-error" role="alert" className="mt-2 px-1 text-sm font-medium text-danger">
          {error}
        </p>
      ) : (
        <p id="save-url-hint" className="mt-2 px-1 text-sm text-fg-subtle">
          {isSaving
            ? `Reading and summarising ${savingCount === 1 ? "your link" : `${savingCount} links`}… you can keep saving.`
            : "We'll fetch the page, then Gemini writes a short summary and picks topic tags."}
        </p>
      )}
    </form>
  );
});
