"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { MAX_FILTER_TAGS, type ItemDto, type ListItemsResponse, type SortOrder } from "@/types/api";
import { api, ApiClientError, buildListSearchParams, type ListParams } from "@/lib/apiClient";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useToast } from "./Toaster";
import { AddItemForm } from "./AddItemForm";
import { FilterBar } from "./FilterBar";
import { ItemList, type PendingSave } from "./ItemList";

interface ItemsBoardProps {
  initialData: ListItemsResponse;
  initialParams: ListParams;
}

const UNDO_WINDOW_MS = 6_000;

function errorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : "Something went wrong. Please try again.";
}

function itemLabel(item: ItemDto): string {
  return item.title ?? new URL(item.url).hostname;
}

/**
 * Client-side owner of the library view. Filter state lives in the page URL
 * (`?q=&tags=&sort=`) so searches are shareable and survive reloads; the
 * server renders the first page from the same params, and every change
 * after that goes through the typed API client.
 */
export function ItemsBoard({ initialData, initialParams }: ItemsBoardProps) {
  const { toast } = useToast();

  const [data, setData] = useState<ListItemsResponse>(initialData);
  const [query, setQuery] = useState(initialParams.q);
  const [activeTags, setActiveTags] = useState<string[]>([...initialParams.tags]);
  const [sort, setSort] = useState<SortOrder>(initialParams.sort);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingSave[]>([]);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(query, 250);
  const params = useMemo<ListParams>(
    () => ({ q: debouncedQuery, tags: activeTags, sort }),
    [debouncedQuery, activeTags, sort],
  );
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const searchRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingKey = useRef(0);
  const pendingDeletes = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // --- list loading ---------------------------------------------------------

  const loadList = useCallback(async (next: ListParams) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    try {
      const result = await api.listItems(next, controller.signal);
      if (controller.signal.aborted) return;
      setData(result);
      setListError(null);
    } catch (error) {
      if (controller.signal.aborted) return;
      setListError(errorMessage(error));
    } finally {
      if (abortRef.current === controller) setIsLoading(false);
    }
  }, []);

  const reload = useCallback(() => loadList(paramsRef.current), [loadList]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    const qs = buildListSearchParams(params).toString();
    window.history.replaceState(window.history.state, "", qs ? `?${qs}` : window.location.pathname);

    if (isFirstRender.current) {
      isFirstRender.current = false; // first page came from the server render
      return;
    }
    void loadList(params);
  }, [params, loadList]);

  // --- keyboard shortcut: "/" focuses search ---------------------------------

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!highlightId) return;
    const timer = setTimeout(() => setHighlightId(null), 2600);
    return () => clearTimeout(timer);
  }, [highlightId]);

  // --- helpers ---------------------------------------------------------------

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const setHidden = useCallback((id: string, hidden: boolean) => {
    setHiddenIds((current) => {
      const next = new Set(current);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const replaceItem = useCallback((item: ItemDto) => {
    setData((current) => ({
      ...current,
      items: current.items.map((existing) => (existing.id === item.id ? item : existing)),
    }));
  }, []);

  // --- save ------------------------------------------------------------------

  const save = useCallback(
    async (url: string) => {
      const key = `pending-${pendingKey.current++}`;
      setPending((current) => [{ key, url, startedAt: Date.now() }, ...current]);
      try {
        const { item, cached } = await api.createItem({ url });
        const title = itemLabel(item);
        if (cached) {
          toast({ kind: "info", title: "Already in your library", description: title });
        } else if (item.status === "READY") {
          toast({ kind: "success", title: "Saved and summarised", description: title });
        } else if (item.status === "PARTIAL") {
          toast({
            kind: "warning",
            title: "Saved, but the AI summary failed",
            description: "You can retry from the card.",
          });
        } else {
          toast({ kind: "error", title: "Saved, but the page couldn't be fetched", description: item.errorMessage ?? undefined });
        }
        setHighlightId(item.id);
        await reload();
      } catch (error) {
        toast({ kind: "error", title: "Couldn't save that link", description: errorMessage(error) });
      } finally {
        setPending((current) => current.filter((p) => p.key !== key));
      }
    },
    [reload, toast],
  );

  // --- delete with undo -------------------------------------------------------

  const commitDelete = useCallback(
    async (item: ItemDto, keepalive = false) => {
      pendingDeletes.current.delete(item.id);
      try {
        await api.deleteItem(item.id, { keepalive });
      } catch (error) {
        if (!(error instanceof ApiClientError && error.status === 404)) {
          setHidden(item.id, false);
          toast({ kind: "error", title: "Couldn't delete that item", description: errorMessage(error) });
          return;
        }
      }
      setData((current) => ({
        ...current,
        items: current.items.filter((i) => i.id !== item.id),
        total: Math.max(0, current.total - 1),
      }));
      setHidden(item.id, false);
      void reload(); // refresh tag counts
    },
    [reload, setHidden, toast],
  );

  const remove = useCallback(
    (item: ItemDto) => {
      setHidden(item.id, true);
      const timer = setTimeout(() => void commitDelete(item), UNDO_WINDOW_MS);
      pendingDeletes.current.set(item.id, timer);
      toast({
        kind: "info",
        title: "Item deleted",
        description: itemLabel(item),
        duration: UNDO_WINDOW_MS - 300,
        action: {
          label: "Undo",
          onClick: () => {
            const pendingTimer = pendingDeletes.current.get(item.id);
            if (!pendingTimer) return;
            clearTimeout(pendingTimer);
            pendingDeletes.current.delete(item.id);
            setHidden(item.id, false);
          },
        },
      });
    },
    [commitDelete, setHidden, toast],
  );

  // Don't lose a delete if the tab closes during the undo window.
  useEffect(() => {
    const deletes = pendingDeletes.current;
    function flush() {
      deletes.forEach((timer, id) => {
        clearTimeout(timer);
        void api.deleteItem(id, { keepalive: true }).catch(() => undefined);
      });
      deletes.clear();
    }
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  // --- retry / regenerate -------------------------------------------------------

  const retry = useCallback(
    async (item: ItemDto) => {
      const regenerating = item.status === "READY";
      setBusy(item.id, true);
      try {
        const { item: updated } = await api.retryItem(item.id);
        replaceItem(updated);
        if (updated.status === "READY") {
          toast({ kind: "success", title: regenerating ? "Summary regenerated" : "Summary ready", description: itemLabel(updated) });
        } else {
          toast({
            kind: "warning",
            title: updated.status === "FAILED" ? "Still couldn't fetch the page" : "The AI summary failed again",
            description: updated.errorMessage ?? undefined,
          });
        }
        void reload();
      } catch (error) {
        toast({ kind: "error", title: regenerating ? "Couldn't regenerate" : "Retry failed", description: errorMessage(error) });
      } finally {
        setBusy(item.id, false);
      }
    },
    [reload, replaceItem, setBusy, toast],
  );

  // --- filters -----------------------------------------------------------------

  const toggleTag = useCallback(
    (tag: string) => {
      setActiveTags((current) => {
        if (current.includes(tag)) return current.filter((t) => t !== tag);
        if (current.length >= MAX_FILTER_TAGS) {
          toast({ kind: "info", title: `You can combine up to ${MAX_FILTER_TAGS} tags` });
          return current;
        }
        return [...current, tag];
      });
    },
    [toast],
  );

  const clearFilters = useCallback(() => {
    setQuery("");
    setActiveTags([]);
  }, []);

  const tryExample = useCallback(
    (url: string) => {
      saveRef.current?.focus();
      void save(url);
    },
    [save],
  );

  const visibleItems = useMemo(
    () => data.items.filter((item) => !hiddenIds.has(item.id)),
    [data.items, hiddenIds],
  );
  const hasFilters = query.trim().length > 0 || activeTags.length > 0;
  const total = Math.max(0, data.total - hiddenIds.size);

  return (
    <div className="flex flex-col gap-10">
      <div className="mx-auto w-full max-w-3xl">
        <AddItemForm ref={saveRef} onSave={(url) => void save(url)} savingCount={pending.length} />
      </div>

      <section aria-labelledby="library-heading" className="flex flex-col gap-6">
        <h2 id="library-heading" className="sr-only">
          Your library
        </h2>
        {(data.total > 0 || hasFilters) && (
          <FilterBar
            ref={searchRef}
            query={query}
            onQueryChange={setQuery}
            sort={sort}
            onSortChange={setSort}
            tags={data.tags}
            activeTags={activeTags}
            onTagToggle={toggleTag}
            onClear={clearFilters}
            shownCount={visibleItems.length}
            totalCount={total}
            isLoading={isLoading}
          />
        )}

        {listError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-soft-fg">
            <span>{listError}</span>
            <button type="button" onClick={() => void reload()} className="btn-secondary py-1.5">
              <RotateCw className="h-4 w-4" aria-hidden="true" /> Try again
            </button>
          </div>
        )}

        <div className={`transition-opacity duration-200 ${isLoading ? "opacity-60" : "opacity-100"}`}>
          <ItemList
            items={visibleItems}
            pending={pending}
            activeTags={activeTags}
            busyIds={busyIds}
            highlightId={highlightId}
            hasFilters={hasFilters}
            libraryEmpty={total === 0 && !hasFilters}
            onTagToggle={toggleTag}
            onDelete={remove}
            onRetry={(item) => void retry(item)}
            onClearFilters={clearFilters}
            onTryExample={tryExample}
          />
        </div>
      </section>
    </div>
  );
}
