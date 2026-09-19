"use client";

import { TagPill } from "./TagPill";

interface FilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  tags: string[];
  activeTag: string | null;
  onTagSelect: (tag: string | null) => void;
}

export function FilterBar({ query, onQueryChange, tags, activeTag, onTagSelect }: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <label htmlFor="filter-query" className="text-sm font-medium text-slate-700">
        Filter your saved items
      </label>
      <input
        id="filter-query"
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search by title, summary, or site…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            Tags:
          </span>
          <button
            type="button"
            onClick={() => onTagSelect(null)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              activeTag === null
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All
          </button>
          {tags.map((tag) => (
            <TagPill
              key={tag}
              tag={tag}
              active={activeTag === tag}
              onClick={() => onTagSelect(activeTag === tag ? null : tag)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
