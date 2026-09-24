"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookmarkPlus, SearchX, Sparkles } from "lucide-react";
import type { ItemDto } from "@/types/api";
import { displayHostname } from "@/lib/format";
import { ItemCard } from "./ItemCard";
import { SummaryDialog } from "./SummaryDialog";

export interface PendingSave {
  key: string;
  url: string;
  startedAt: number;
}

interface ItemListProps {
  items: ItemDto[];
  pending: PendingSave[];
  activeTags: readonly string[];
  busyIds: ReadonlySet<string>;
  highlightId: string | null;
  hasFilters: boolean;
  libraryEmpty: boolean;
  onTagToggle: (tag: string) => void;
  onDelete: (item: ItemDto) => void;
  onRetry: (item: ItemDto) => void;
  onClearFilters: () => void;
  /** Home only: example links for an empty library. Elsewhere the empty state links home. */
  onTryExample?: (url: string) => void;
}

const EXAMPLE_LINKS = [
  "https://en.wikipedia.org/wiki/Web_cache",
  "https://react.dev/learn/thinking-in-react",
  "https://www.postgresql.org/about/",
];

export function ItemList(props: ItemListProps) {
  const { items, pending, hasFilters, libraryEmpty } = props;
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const summaryTrigger = useRef<HTMLElement | null>(null);
  // Looked up by id so a retry/regenerate shows up in an open modal; a deleted item closes it.
  const summaryItem = (summaryId && items.find((item) => item.id === summaryId)) || null;

  if (items.length === 0 && pending.length === 0) {
    return libraryEmpty ? (
      <EmptyLibrary onTryExample={props.onTryExample} />
    ) : hasFilters ? (
      <NoResults onClear={props.onClearFilters} />
    ) : null;
  }

  function openSummary(item: ItemDto, trigger: HTMLElement) {
    summaryTrigger.current = trigger;
    setSummaryId(item.id);
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Saved items">
        {pending.map((p) => (
          <li key={p.key}>
            <PendingCard save={p} />
          </li>
        ))}
        {items.map((item) => (
          <li key={item.id}>
            <ItemCard
              item={item}
              activeTags={props.activeTags}
              busy={props.busyIds.has(item.id)}
              highlighted={props.highlightId === item.id}
              onTagToggle={props.onTagToggle}
              onDelete={props.onDelete}
              onRetry={props.onRetry}
              onOpenSummary={openSummary}
            />
          </li>
        ))}
      </ul>
      <SummaryDialog
        item={summaryItem}
        busy={summaryItem ? props.busyIds.has(summaryItem.id) : false}
        onRetry={props.onRetry}
        onClose={() => setSummaryId(null)}
        returnFocusRef={summaryTrigger}
      />
    </>
  );
}

const STAGES = [
  { after: 0, label: "Fetching the page" },
  { after: 1500, label: "Reading the content" },
  { after: 3000, label: "Writing a summary with AI" },
  { after: 9000, label: "Almost there" },
];

/** Skeleton card shown while a save is in flight, with staged progress text. */
function PendingCard({ save }: { save: PendingSave }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Date.now() - save.startedAt), 250);
    return () => clearInterval(timer);
  }, [save.startedAt]);

  const stageIndex = STAGES.reduce((acc, stage, i) => (elapsed >= stage.after ? i : acc), 0);
  const stage = STAGES[stageIndex] ?? STAGES[0];
  const progress = Math.min(92, 8 + (elapsed / 8000) * 84);

  return (
    <article className="card relative flex h-full flex-col overflow-hidden" aria-busy="true" aria-label={`Saving ${save.url}`}>
      <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-line bg-muted">
        <Shimmer />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-card">
            <Sparkles className="h-5 w-5 animate-pulse text-accent" aria-hidden="true" />
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <p className="truncate text-xs font-medium text-fg-muted">{displayHostname(save.url)}</p>
        <div className="space-y-2" aria-hidden="true">
          <div className="relative h-5 w-5/6 overflow-hidden rounded bg-muted"><Shimmer /></div>
          <div className="relative h-3.5 w-full overflow-hidden rounded bg-muted"><Shimmer /></div>
          <div className="relative h-3.5 w-full overflow-hidden rounded bg-muted"><Shimmer /></div>
          <div className="relative h-3.5 w-2/3 overflow-hidden rounded bg-muted"><Shimmer /></div>
        </div>
        <div className="mt-auto pt-2">
          <p className="mb-2 text-sm font-medium text-accent" role="status">
            {stage?.label}…
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function Shimmer() {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/[0.06]"
    />
  );
}

function EmptyLibrary({ onTryExample }: { onTryExample?: (url: string) => void }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center sm:py-20">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-fg">
        <BookmarkPlus className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight">Your library is empty</h2>
      <p className="mt-2 max-w-md text-fg-muted">
        {onTryExample ? "Paste any article or page above." : "Save any article or page from the home page."} Each link
        gets a short AI summary and topic tags, so it&apos;s easy to find again.
      </p>
      {onTryExample ? (
        <div className="mt-6 flex flex-col items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Or try one of these</p>
          <ul className="flex flex-wrap justify-center gap-2">
            {EXAMPLE_LINKS.map((url) => (
              <li key={url}>
                <button type="button" onClick={() => onTryExample(url)} className="btn-secondary text-sm">
                  {displayHostname(url)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Link href="/" className="btn-primary mt-6">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Save your first link
        </Link>
      )}
    </div>
  );
}

export function NoResults({
  onClear,
  title = "No items match these filters",
  hint = "Try a different keyword, or remove a tag.",
  clearLabel = "Clear filters",
}: {
  onClear: () => void;
  title?: string;
  hint?: string;
  clearLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
      <SearchX className="h-10 w-10 text-fg-subtle" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-fg-muted">{hint}</p>
      <button type="button" onClick={onClear} className="btn-secondary mt-5">
        {clearLabel}
      </button>
    </div>
  );
}
