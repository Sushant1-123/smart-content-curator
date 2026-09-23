"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiErrorSchema,
  CreateItemResponseSchema,
  DeleteItemResponseSchema,
  ListItemsResponseSchema,
  RetryItemResponseSchema,
  type ItemDto,
} from "@/types/api";
import { AddItemForm } from "./AddItemForm";
import { FilterBar } from "./FilterBar";
import { ItemList } from "./ItemList";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

interface ItemsBoardProps {
  initialItems: ItemDto[];
  initialTags: string[];
}

export function ItemsBoard({ initialItems, initialTags }: ItemsBoardProps) {
  const [items, setItems] = useState<ItemDto[]>(initialItems);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(query, 300);
  const isFirstRender = useRef(true);
  const requestId = useRef(0);

  const fetchItems = useCallback(async (q: string, tag: string | null) => {
    const thisRequest = ++requestId.current;
    setIsLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("query", q);
      if (tag) params.set("tag", tag);

      const res = await fetch(`/api/items?${params.toString()}`);
      if (thisRequest !== requestId.current) return; // stale response, ignore

      if (!res.ok) throw new Error("Failed to load items");
      const data = ListItemsResponseSchema.parse(await res.json());
      setItems(data.items);
      setTags(data.availableTags);
    } catch {
      if (thisRequest === requestId.current) {
        setListError("Couldn't load your saved items. Check your connection and try again.");
      }
    } finally {
      if (thisRequest === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return; // initial data already came from the server render
    }
    fetchItems(debouncedQuery, activeTag);
  }, [debouncedQuery, activeTag, fetchItems]);

  async function handleAddUrl(url: string): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const error = ApiErrorSchema.parse(await res.json());
        return { ok: false, message: error.error.message };
      }
      const data = CreateItemResponseSchema.parse(await res.json());

      // Refresh the current view so filters/tags stay consistent with the
      // server (simplest correct approach; the list is small and this
      // endpoint is cached — see lib/responseCache.ts).
      await fetchItems(debouncedQuery, activeTag);
      return { ok: true };
    } catch {
      return { ok: false, message: "Network error — please try again." };
    }
  }

  async function handleDelete(id: string) {
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== id));
    setBusyIds((current) => new Set(current).add(id));
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      DeleteItemResponseSchema.parse(await res.json());
    } catch {
      setItems(previous); // revert optimistic update
      setActionError("Couldn't remove that item. Please try again.");
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleRetry(id: string) {
    setBusyIds((current) => new Set(current).add(id));
    try {
      const res = await fetch(`/api/items/${id}/retry`, { method: "POST" });
      if (res.ok) {
        const data = RetryItemResponseSchema.parse(await res.json());
        setItems((current) => current.map((item) => (item.id === id ? data.item : item)));
        if (data.item.tags.length) {
          setTags((current) => Array.from(new Set([...current, ...data.item.tags])).sort());
        }
      } else {
        const error = ApiErrorSchema.parse(await res.json());
        setActionError(error.error.message);
      }
    } catch {
      setActionError("Couldn't retry AI enrichment. Please try again.");
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <AddItemForm onSubmit={handleAddUrl} />
      <FilterBar
        query={query}
        onQueryChange={setQuery}
        tags={tags}
        activeTag={activeTag}
        onTagSelect={setActiveTag}
      />
      {listError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {listError}
        </p>
      )}
      {actionError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </p>
      )}
      <ItemList
        items={items}
        isLoading={isLoading}
        busyIds={busyIds}
        onTagClick={(tag) => setActiveTag((current) => (current === tag ? null : tag))}
        onDelete={handleDelete}
        onRetry={handleRetry}
        hasActiveFilter={Boolean(query || activeTag)}
      />
    </div>
  );
}
