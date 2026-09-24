"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Loader2, RefreshCw, Sparkles, Trash2, WifiOff } from "lucide-react";
import type { ItemDto } from "@/types/api";
import { displayHostname } from "@/lib/format";
import { formatShortDate } from "@/lib/date";
import { Favicon } from "./Favicon";
import { Thumbnail } from "./Thumbnail";
import { TagPill } from "./TagPill";

interface ItemCardProps {
  item: ItemDto;
  activeTags: readonly string[];
  busy: boolean;
  highlighted: boolean;
  onTagToggle: (tag: string) => void;
  onDelete: (item: ItemDto) => void;
  onRetry: (item: ItemDto) => void;
}

export function ItemCard({ item, activeTags, busy, highlighted, onTagToggle, onDelete, onRetry }: ItemCardProps) {
  const hostname = displayHostname(item.url);
  const title = item.title || hostname;
  const titleId = `item-title-${item.id}`;

  return (
    <article
      aria-labelledby={titleId}
      aria-busy={busy}
      className={`card group relative flex h-full flex-col overflow-hidden transition-shadow duration-200 hover:shadow-card-hover ${
        highlighted ? "animate-highlight-ring" : ""
      }`}
    >
      <a href={item.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
        <Thumbnail
          src={item.imageUrl}
          hostname={hostname}
          faviconUrl={item.faviconUrl}
          className="aspect-[16/9] w-full border-b border-line"
        />
      </a>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs text-fg-subtle">
          <Favicon src={item.faviconUrl} hostname={hostname} />
          <span className="truncate font-medium text-fg-muted">{item.siteName || hostname}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.createdAt} className="shrink-0" title={`Saved ${formatShortDate(item.createdAt)}`}>
            {formatShortDate(item.createdAt)}
          </time>
        </div>

        <h3 id={titleId} className="font-display text-lg font-semibold leading-snug tracking-tight text-fg">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-2 rounded-sm decoration-accent/40 decoration-2 underline-offset-4 hover:underline"
          >
            {title}
          </a>
        </h3>

        {item.status === "READY" && item.summary && (
          <p className="line-clamp-4 text-sm leading-relaxed text-fg-muted">{item.summary}</p>
        )}

        {item.status === "PARTIAL" && (
          <StatusPanel
            tone="warning"
            icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
            title="AI summary unavailable"
            message={item.errorMessage}
            fallback={item.description}
            actionLabel="Retry summary"
            busy={busy}
            onAction={() => onRetry(item)}
          />
        )}

        {item.status === "FAILED" && (
          <StatusPanel
            tone="danger"
            icon={<WifiOff className="h-4 w-4" aria-hidden="true" />}
            title="Couldn't fetch this page"
            message={item.errorMessage}
            actionLabel="Try again"
            busy={busy}
            onAction={() => onRetry(item)}
          />
        )}

        {item.status === "PENDING" && (
          <p className="flex items-center gap-2 text-sm text-fg-subtle">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Summarising…
          </p>
        )}

        {item.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
            {item.tags.map((tag) => (
              <li key={tag}>
                <TagPill tag={tag} active={activeTags.includes(tag)} onToggle={onTagToggle} />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn -ml-2 px-2 py-1.5 text-accent hover:bg-accent-soft"
          >
            Open <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{title} (opens in a new tab)</span>
          </a>
          <div className="flex items-center">
            <Link href={`/items/${item.id}`} className="btn-ghost px-2 py-1.5 text-xs">
              Details<span className="sr-only"> for {title}</span>
            </Link>
            {item.status === "READY" && (
              <button
                type="button"
                onClick={() => onRetry(item)}
                disabled={busy}
                className="icon-btn"
                aria-label={`Regenerate summary for ${title}`}
                title="Regenerate summary"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(item)}
              disabled={busy}
              className="icon-btn hover:bg-danger-soft hover:text-danger"
              aria-label={`Delete ${title}`}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

interface StatusPanelProps {
  tone: "warning" | "danger";
  icon: React.ReactNode;
  title: string;
  message: string | null;
  fallback?: string | null;
  actionLabel: string;
  busy: boolean;
  onAction: () => void;
}

function StatusPanel({ tone, icon, title, message, fallback, actionLabel, busy, onAction }: StatusPanelProps) {
  const toneClass =
    tone === "warning" ? "bg-warning-soft text-warning-soft-fg" : "bg-danger-soft text-danger-soft-fg";
  return (
    <div className="flex flex-col gap-2">
      {fallback && <p className="line-clamp-3 text-sm leading-relaxed text-fg-muted">{fallback}</p>}
      <div className={`rounded-xl p-3 text-sm ${toneClass}`}>
        <p className="flex items-center gap-1.5 font-medium">
          {icon}
          {title}
        </p>
        {message && <p className="mt-1 line-clamp-2 break-words text-xs opacity-90">{message}</p>}
        <button
          type="button"
          onClick={onAction}
          disabled={busy}
          className="btn mt-2 border border-black/10 bg-white/40 dark:border-white/10 px-2.5 py-1 text-xs font-semibold hover:bg-white/70 dark:bg-black/20 dark:hover:bg-black/40"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {busy ? "Working…" : actionLabel}
        </button>
      </div>
    </div>
  );
}
