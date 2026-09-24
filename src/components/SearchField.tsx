"use client";

import { forwardRef } from "react";
import { Loader2, Search, X } from "lucide-react";

interface SearchFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  isLoading: boolean;
}

/** Search box with a clear button, Esc-to-clear and a "/" shortcut hint. */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { id, label, placeholder, value, onChange, isLoading },
  ref,
) {
  return (
    <div className="relative flex-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
        aria-hidden="true"
      />
      <input
        ref={ref}
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          }
        }}
        placeholder={placeholder}
        className="input h-11 pl-10 pr-16 text-sm [&::-webkit-search-cancel-button]:hidden"
        autoComplete="off"
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-fg-subtle" aria-hidden="true" />}
        {value ? (
          <button type="button" onClick={() => onChange("")} className="icon-btn h-7 w-7" aria-label="Clear search">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <kbd className="hidden rounded border border-line bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium text-fg-subtle sm:inline">
            /
          </kbd>
        )}
      </div>
    </div>
  );
});
