"use client";

import { AlertTriangle, ArrowUpRight, Loader2, RefreshCw } from "lucide-react";
import type { ItemDto } from "@/types/api";
import { displayHostname } from "@/lib/format";
import { formatShortDate } from "@/lib/date";
import { Favicon } from "./Favicon";
import { TagPill } from "./TagPill";

/** Pieces shared by the card, the Summary modal and the /summaries reading view. */

export function itemTitle(item: ItemDto): string {
  return item.title || displayHostname(item.url);
}

/** Favicon · source · saved date. */
export function ItemMeta({ item, className = "text-xs" }: { item: ItemDto; className?: string }) {
  const hostname = displayHostname(item.url);
  return (
    <div className={`flex min-w-0 items-center gap-2 text-fg-subtle ${className}`}>
      <Favicon src={item.faviconUrl} hostname={hostname} />
      <span className="truncate font-medium text-fg-muted">{item.siteName || hostname}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={item.createdAt} className="shrink-0" title={`Saved ${formatShortDate(item.createdAt)}`}>
        {formatShortDate(item.createdAt)}
      </time>
    </div>
  );
}

interface FullSummaryProps {
  item: ItemDto;
  busy: boolean;
  onRetry: (item: ItemDto) => void;
}

/** The whole AI summary, or a compact "Summary unavailable" note with Retry. */
export function FullSummary({ item, busy, onRetry }: FullSummaryProps) {
  if (item.status === "READY" && item.summary) {
    return <p className="whitespace-pre-line text-base leading-relaxed text-fg">{item.summary}</p>;
  }
  if (item.status === "PENDING") {
    return (
      <p className="flex items-center gap-2 text-sm text-fg-subtle">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Summarising…
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-warning-soft px-3 py-2.5 text-sm text-warning-soft-fg">
      <p className="flex min-w-0 flex-1 items-center gap-1.5 font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Summary unavailable
          {item.errorMessage && <span className="block text-xs font-normal opacity-90 line-clamp-2">{item.errorMessage}</span>}
        </span>
      </p>
      <button
        type="button"
        onClick={() => onRetry(item)}
        disabled={busy}
        className="btn border border-black/10 bg-white/40 px-2.5 py-1 text-xs font-semibold hover:bg-white/70 dark:border-white/10 dark:bg-black/20 dark:hover:bg-black/40"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {busy ? "Working…" : "Retry"}
        <span className="sr-only"> summary for {itemTitle(item)}</span>
      </button>
    </div>
  );
}

export function TagList({ tags }: { tags: readonly string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag}>
          <TagPill tag={tag} />
        </li>
      ))}
    </ul>
  );
}

export function OpenOriginalLink({ item, className = "" }: { item: ItemDto; className?: string }) {
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className={`btn-primary ${className}`}>
      Open original post <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
