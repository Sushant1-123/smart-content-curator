"use client";

import { forwardRef, useState } from "react";
import { ArrowDownUp, X } from "lucide-react";
import type { SortOrder, TagCount } from "@/types/api";
import { TagPill } from "./TagPill";
import { SearchField } from "./SearchField";

const COLLAPSED_TAG_COUNT = 14;

interface FilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  sort: SortOrder;
  onSortChange: (value: SortOrder) => void;
  tags: TagCount[];
  activeTags: readonly string[];
  onTagToggle: (tag: string) => void;
  onClear: () => void;
  /** Items rendered right now. */
  shownCount: number;
  /** Items matching the current filters, across all pages. */
  totalCount: number;
  isLoading: boolean;
}

export const FilterBar = forwardRef<HTMLInputElement, FilterBarProps>(function FilterBar(
  {
    query,
    onQueryChange,
    sort,
    onSortChange,
    tags,
    activeTags,
    onTagToggle,
    onClear,
    shownCount,
    totalCount,
    isLoading,
  },
  searchRef,
) {
  const [expanded, setExpanded] = useState(false);
  const hasFilters = query.trim().length > 0 || activeTags.length > 0;

  // Selected tags always stay visible, even when the list is collapsed.
  const visibleTags = expanded
    ? tags
    : [
        ...tags.filter((t) => activeTags.includes(t.name)),
        ...tags.filter((t) => !activeTags.includes(t.name)),
      ].slice(0, Math.max(COLLAPSED_TAG_COUNT, activeTags.length));
  const hiddenCount = tags.length - visibleTags.length;

  return (
    <section aria-label="Search and filter" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          ref={searchRef}
          id="search"
          label="Search saved items"
          placeholder="Search titles, summaries and tags"
          value={query}
          onChange={onQueryChange}
          isLoading={isLoading}
        />

        <div className="relative">
          <label htmlFor="sort" className="sr-only">
            Sort order
          </label>
          <ArrowDownUp
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
            aria-hidden="true"
          />
          <select
            id="sort"
            value={sort}
            onChange={(e) => onSortChange(e.target.value === "oldest" ? "oldest" : "newest")}
            className="input h-11 w-full cursor-pointer appearance-none pl-9 pr-8 text-sm sm:w-auto"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-subtle" aria-hidden="true">
            ▾
          </span>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Filter by tag</h2>
          {/* `relative` keeps the chips' absolutely positioned sr-only text inside the scroller. */}
          <ul
            className="relative -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden [&>li]:shrink-0"
            aria-label="Tags"
          >
            {visibleTags.map((tag) => (
              <li key={tag.name}>
                <TagPill
                  tag={tag.name}
                  count={tag.count}
                  active={activeTags.includes(tag.name)}
                  onToggle={onTagToggle}
                  size="md"
                />
              </li>
            ))}
            {(hiddenCount > 0 || expanded) && tags.length > COLLAPSED_TAG_COUNT && (
              <li>
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="btn rounded-full px-3 py-1.5 text-sm text-accent hover:bg-accent-soft"
                  aria-expanded={expanded}
                >
                  {expanded ? "Show fewer" : `+${hiddenCount} more`}
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <p className="text-sm text-fg-muted" aria-live="polite" aria-atomic="true">
          {hasFilters || shownCount < totalCount ? (
            <>
              Showing <strong className="font-semibold text-fg">{shownCount}</strong> of {totalCount}{" "}
              {totalCount === 1 ? "item" : "items"}
              {activeTags.length > 0 && (
                <>
                  {" "}
                  tagged <strong className="font-semibold text-fg">{activeTags.join(" + ")}</strong>
                </>
              )}
              {query.trim() && (
                <>
                  {" "}
                  matching “<strong className="font-semibold text-fg">{query.trim()}</strong>”
                </>
              )}
            </>
          ) : (
            <>
              <strong className="font-semibold text-fg">{totalCount}</strong> saved {totalCount === 1 ? "item" : "items"}
            </>
          )}
        </p>
        {hasFilters && (
          <button type="button" onClick={onClear} className="btn-ghost py-1.5 text-sm">
            <X className="h-4 w-4" aria-hidden="true" />
            Clear filters
          </button>
        )}
      </div>
    </section>
  );
});
