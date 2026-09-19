"use client";

import type { ItemDto } from "@/types/api";
import { ItemCard } from "./ItemCard";

interface ItemListProps {
  items: ItemDto[];
  isLoading: boolean;
  busyIds: Set<string>;
  onTagClick: (tag: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  hasActiveFilter: boolean;
}

export function ItemList({
  items,
  isLoading,
  busyIds,
  onTagClick,
  onDelete,
  onRetry,
  hasActiveFilter,
}: ItemListProps) {
  if (isLoading && items.length === 0) {
    return (
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-busy="true"
        aria-label="Loading saved items"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center">
        <p className="text-lg font-medium text-slate-700">
          {hasActiveFilter ? "No items match your filter" : "No saved items yet"}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {hasActiveFilter
            ? "Try a different keyword or tag."
            : "Paste a link above to save and enrich your first item."}
        </p>
      </div>
    );
  }

  return (
    <ul
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Saved items"
    >
      {items.map((item) => (
        <li key={item.id}>
          <ItemCard
            item={item}
            onTagClick={onTagClick}
            onDelete={onDelete}
            onRetry={onRetry}
            isBusy={busyIds.has(item.id)}
          />
        </li>
      ))}
    </ul>
  );
}
