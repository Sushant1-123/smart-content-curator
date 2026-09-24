"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPageTokens } from "@/lib/pagination";

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Accessible name, e.g. "Saved items pages". */
  label: string;
}

/**
 * Prev · 1 … 4 5 6 … 12 · Next on tablet/desktop; a compact
 * "‹ Prev  Page X of Y  Next ›" on phones. Hidden when there's one page.
 */
export function Pagination({ page, pageCount, onPageChange, label }: PaginationProps) {
  if (pageCount <= 1) return null;
  const isFirst = page <= 1;
  const isLast = page >= pageCount;

  const prev = (
    <button type="button" onClick={() => onPageChange(page - 1)} disabled={isFirst} className="btn-secondary">
      <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Prev<span className="sr-only">ious page</span>
    </button>
  );
  const next = (
    <button type="button" onClick={() => onPageChange(page + 1)} disabled={isLast} className="btn-secondary">
      Next<span className="sr-only"> page</span> <ChevronRight className="h-4 w-4" aria-hidden="true" />
    </button>
  );

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-2 border-t border-line pt-6 sm:justify-center">
      {prev}

      <p className="text-sm text-fg-muted sm:hidden">
        Page <strong className="font-semibold text-fg">{page}</strong> of {pageCount}
      </p>

      <ul className="hidden items-center gap-1 sm:flex">
        {getPageTokens(page, pageCount).map((token, index) =>
          token === "ellipsis" ? (
            <li key={`ellipsis-${index}`} aria-hidden="true" className="w-9 text-center text-sm text-fg-subtle">
              …
            </li>
          ) : (
            <li key={token}>
              <button
                type="button"
                onClick={() => onPageChange(token)}
                aria-current={token === page ? "page" : undefined}
                aria-label={`Page ${token}`}
                className={`btn h-9 min-w-9 px-2 tabular-nums ${
                  token === page ? "bg-accent text-accent-fg hover:bg-accent-hover" : "text-fg-muted hover:bg-muted hover:text-fg"
                }`}
              >
                {token}
              </button>
            </li>
          ),
        )}
      </ul>

      {next}
    </nav>
  );
}
