"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAX_FILTER_TAGS, type ItemDto, type ListItemsResponse, type SortOrder } from "@/types/api";
import { api, ApiClientError, buildListSearchParams, type ListParams } from "@/lib/apiClient";
import { buildFilterKey, resolvePage } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useToast } from "@/components/Toaster";

const UNDO_WINDOW_MS = 6_000;

export function errorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : "Something went wrong. Please try again.";
}

export function itemLabel(item: ItemDto): string {
  return item.title ?? new URL(item.url).hostname;
}

interface UseItemsLibraryOptions {
  initialData: ListItemsResponse;
  initialParams: ListParams;
  /** Rows per request (`limit` on GET /api/items). */
  limit: number;
}

/**
 * Client-side owner of a library view (home, /items, /summaries). Filter
 * and page state live in the page URL (`?q=&tags=&sort=&page=`) so views
 * are shareable and survive reloads; the server renders the first page from
 * the same params, and every change after that goes through the typed API
 * client. Changing the search, tags or sort always returns to page 1.
 */
export function useItemsLibrary({ initialData, initialParams, limit }: UseItemsLibraryOptions) {
  const { toast } = useToast();

  const [data, setData] = useState<ListItemsResponse>(initialData);
  const [query, setQuery] = useState(initialParams.q);
  const [activeTags, setActiveTags] = useState<string[]>([...initialParams.tags]);
  const [sort, setSort] = useState<SortOrder>(initialParams.sort);
  const [pageSelection, setPageSelection] = useState(() => ({
    page: initialData.page,
    filterKey: buildFilterKey(initialParams),
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(query, 250);
  const filterKey = buildFilterKey({ q: debouncedQuery, tags: activeTags, sort });
  const page = resolvePage(pageSelection, filterKey);
  const params = useMemo<ListParams>(
    () => ({ q: debouncedQuery, tags: activeTags, sort, page }),
    [debouncedQuery, activeTags, sort, page],
  );
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const searchRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingDeletes = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // --- list loading ---------------------------------------------------------

  const loadList = useCallback(
    async (next: ListParams) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);
      try {
        const result = await api.listItems(next, limit, controller.signal);
        if (controller.signal.aborted) return;
        setData(result);
        setListError(null);
        // The server clamps a page past the end (e.g. after deleting the last item on it).
        if (result.page !== next.page) setPageSelection({ page: result.page, filterKey: buildFilterKey(next) });
      } catch (error) {
        if (controller.signal.aborted) return;
        setListError(errorMessage(error));
      } finally {
        if (abortRef.current === controller) setIsLoading(false);
      }
    },
    [limit],
  );

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
      if (target?.closest("input, textarea, select, dialog, [contenteditable='true']")) return;
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

  // --- delete with undo -------------------------------------------------------

  const commitDelete = useCallback(
    async (item: ItemDto) => {
      pendingDeletes.current.delete(item.id);
      try {
        await api.deleteItem(item.id);
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
        matched: Math.max(0, current.matched - 1),
      }));
      setHidden(item.id, false);
      void reload(); // refresh tag counts and refill the page
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

  // --- filters and paging ---------------------------------------------------------

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

  const goToPage = useCallback(
    (next: number) => {
      setPageSelection({ page: next, filterKey });
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    },
    [filterKey],
  );

  const visibleItems = useMemo(
    () => data.items.filter((item) => !hiddenIds.has(item.id)),
    [data.items, hiddenIds],
  );

  return {
    data,
    visibleItems,
    query,
    setQuery,
    activeTags,
    toggleTag,
    sort,
    setSort,
    clearFilters,
    hasFilters: query.trim().length > 0 || activeTags.length > 0,
    /** Matching items, minus those waiting out their undo window. */
    matchedCount: Math.max(0, data.matched - hiddenIds.size),
    libraryCount: Math.max(0, data.total - hiddenIds.size),
    page,
    goToPage,
    params,
    isLoading,
    listError,
    reload,
    busyIds,
    hiddenIds,
    highlightId,
    setHighlightId,
    remove,
    retry,
    searchRef,
  };
}
