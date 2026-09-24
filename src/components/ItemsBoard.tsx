"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import type { ListItemsResponse } from "@/types/api";
import { api, buildListSearchParams, type ListParams } from "@/lib/apiClient";
import { HOME_FETCH_LIMIT, HOME_PREVIEW_COUNT, PAGE_SIZE, selectHomeItems } from "@/lib/pagination";
import { errorMessage, itemLabel, useItemsLibrary } from "@/lib/useItemsLibrary";
import { useToast } from "./Toaster";
import { AddItemForm } from "./AddItemForm";
import { FilterBar } from "./FilterBar";
import { ItemList, type PendingSave } from "./ItemList";
import { ListError } from "./ListError";

interface ItemsBoardProps {
  initialData: ListItemsResponse;
  initialParams: ListParams;
}

/**
 * The home page: save form, filters, the 3 newest matching items, and
 * shortcuts to the full library (/items) and the reading view (/summaries).
 */
export function ItemsBoard({ initialData, initialParams }: ItemsBoardProps) {
  const { toast } = useToast();
  const library = useItemsLibrary({ initialData, initialParams, limit: HOME_FETCH_LIMIT });
  const { reload, setHighlightId } = library;

  const [pending, setPending] = useState<PendingSave[]>([]);
  const saveRef = useRef<HTMLInputElement>(null);
  const pendingKey = useRef(0);

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
    [reload, setHighlightId, toast],
  );

  const tryExample = useCallback(
    (url: string) => {
      saveRef.current?.focus();
      void save(url);
    },
    [save],
  );

  const previewItems = selectHomeItems(library.data.items, library.hiddenIds, pending.length);
  const { matchedCount, libraryCount, hasFilters } = library;
  const moreCount = matchedCount - previewItems.length;
  const showMore = matchedCount > HOME_PREVIEW_COUNT && moreCount > 0;
  const moreQuery = buildListSearchParams({ ...library.params, page: 1 }).toString();

  return (
    <div className="flex flex-col gap-10">
      <div className="mx-auto w-full max-w-3xl">
        <AddItemForm ref={saveRef} onSave={(url) => void save(url)} savingCount={pending.length} />
      </div>

      <section aria-labelledby="library-heading" className="flex flex-col gap-6">
        <h2 id="library-heading" className="sr-only">
          Your library
        </h2>
        {(library.data.total > 0 || hasFilters) && (
          <FilterBar
            ref={library.searchRef}
            query={library.query}
            onQueryChange={library.setQuery}
            sort={library.sort}
            onSortChange={library.setSort}
            tags={library.data.tags}
            activeTags={library.activeTags}
            onTagToggle={library.toggleTag}
            onClear={library.clearFilters}
            shownCount={previewItems.length}
            totalCount={matchedCount}
            isLoading={library.isLoading}
          />
        )}

        {library.listError && <ListError message={library.listError} onRetry={() => void reload()} />}

        <div className={`transition-opacity duration-200 ${library.isLoading ? "opacity-60" : "opacity-100"}`}>
          <ItemList
            items={previewItems}
            pending={pending}
            activeTags={library.activeTags}
            busyIds={library.busyIds}
            highlightId={library.highlightId}
            hasFilters={hasFilters}
            libraryEmpty={libraryCount === 0 && !hasFilters}
            onTagToggle={library.toggleTag}
            onDelete={library.remove}
            onRetry={(item) => void library.retry(item)}
            onClearFilters={library.clearFilters}
            onTryExample={tryExample}
          />
        </div>

        {(showMore || libraryCount > 0) && (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2" aria-label="Browse your library">
            {showMore && (
              <li>
                <NavCard
                  href={`/items${moreQuery ? `?${moreQuery}` : ""}`}
                  icon={<Layers className="h-5 w-5" aria-hidden="true" />}
                  title={`+${moreCount} more saved ${moreCount === 1 ? "item" : "items"}`}
                  description={hasFilters ? "See every item matching these filters" : `Browse your whole library, ${PAGE_SIZE} per page`}
                />
              </li>
            )}
            {libraryCount > 0 && (
              <li>
                <NavCard
                  href="/summaries"
                  icon={<span aria-hidden="true">📄</span>}
                  title={`Read all ${libraryCount} ${libraryCount === 1 ? "summary" : "summaries"}`}
                  description="Every AI summary in one clean reading view"
                />
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

interface NavCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function NavCard({ href, icon, title, description }: NavCardProps) {
  return (
    <Link
      href={href}
      className="card group flex h-full items-center gap-4 p-4 transition-shadow duration-200 hover:shadow-card-hover sm:p-5"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-lg text-accent-soft-fg">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-display text-lg font-semibold tracking-tight text-fg">
          {title}
          <ArrowRight
            className="h-4 w-4 shrink-0 text-accent transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
        <span className="mt-0.5 block text-sm text-fg-muted">{description}</span>
      </span>
    </Link>
  );
}
