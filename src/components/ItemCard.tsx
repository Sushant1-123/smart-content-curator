"use client";

import type { ItemDto } from "@/types/api";
import { TagPill } from "./TagPill";
import { StatusBadge } from "./StatusBadge";
import { formatSavedDate } from "@/lib/date";

interface ItemCardProps {
  item: ItemDto;
  onTagClick: (tag: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  isBusy?: boolean;
}

export function ItemCard({ item, onTagClick, onDelete, onRetry, isBusy }: ItemCardProps) {
  const hostname = safeHostname(item.url);

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {item.imageUrl ? (
        // Plain <img>, not next/image: thumbnails come from arbitrary
        // third-party domains supplied at runtime (see next.config.mjs).
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          className="h-40 w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div
          className="flex h-40 w-full items-center justify-center bg-slate-100 text-slate-300"
          aria-hidden
        >
          <span className="text-3xl font-semibold">{hostname?.[0]?.toUpperCase() ?? "?"}</span>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold leading-snug text-slate-900 hover:text-brand-600"
          >
            {item.title || item.url}
          </a>
          <StatusBadge status={item.status} />
        </div>

        {hostname && <p className="text-xs text-slate-400">{item.siteName || hostname}</p>}

        {item.status === "READY" && item.summary && (
          <p className="line-clamp-3 text-sm text-slate-600">{item.summary}</p>
        )}

        {item.status === "PARTIAL" && (
          <div className="rounded-md bg-orange-50 p-2 text-xs text-orange-700">
            <p>AI summary couldn&apos;t be generated{item.errorMessage ? `: ${item.errorMessage}` : "."}</p>
            <button
              type="button"
              onClick={() => onRetry(item.id)}
              disabled={isBusy}
              className="mt-1 font-medium underline underline-offset-2 disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        )}

        {item.status === "FAILED" && (
          <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">
            Couldn&apos;t fetch this page{item.errorMessage ? `: ${item.errorMessage}` : "."}
          </div>
        )}

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <TagPill key={tag} tag={tag} onClick={onTagClick} />
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-slate-400">
          <time dateTime={item.createdAt}>{formatSavedDate(item.createdAt)}</time>
          <div className="flex items-center gap-3">
            <a href={`/items/${item.id}`} className="font-medium text-slate-500 hover:text-brand-600">
              Details
            </a>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              disabled={isBusy}
              className="font-medium text-slate-400 hover:text-red-600 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
