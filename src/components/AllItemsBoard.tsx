"use client";

import type { ListItemsResponse } from "@/types/api";
import type { ListParams } from "@/lib/apiClient";
import { PAGE_SIZE } from "@/lib/pagination";
import { useItemsLibrary } from "@/lib/useItemsLibrary";
import { FilterBar } from "./FilterBar";
import { ItemList } from "./ItemList";
import { ListError } from "./ListError";
import { Pagination } from "./Pagination";

interface AllItemsBoardProps {
  initialData: ListItemsResponse;
  initialParams: ListParams;
}

/** /items: the whole library, 15 cards per page, with the home page's filters. */
export function AllItemsBoard({ initialData, initialParams }: AllItemsBoardProps) {
  const library = useItemsLibrary({ initialData, initialParams, limit: PAGE_SIZE });
  const { data, visibleItems, hasFilters } = library;

  return (
    <section aria-label="All saved items" className="flex flex-col gap-6">
      {(data.total > 0 || hasFilters) && (
        <FilterBar
          ref={library.searchRef}
          query={library.query}
          onQueryChange={library.setQuery}
          sort={library.sort}
          onSortChange={library.setSort}
          tags={data.tags}
          activeTags={library.activeTags}
          onTagToggle={library.toggleTag}
          onClear={library.clearFilters}
          shownCount={visibleItems.length}
          totalCount={library.matchedCount}
          isLoading={library.isLoading}
        />
      )}

      {library.listError && <ListError message={library.listError} onRetry={() => void library.reload()} />}

      <div className={`transition-opacity duration-200 ${library.isLoading ? "opacity-60" : "opacity-100"}`}>
        <ItemList
          items={visibleItems}
          pending={[]}
          activeTags={library.activeTags}
          busyIds={library.busyIds}
          highlightId={library.highlightId}
          hasFilters={hasFilters}
          libraryEmpty={library.libraryCount === 0 && !hasFilters}
          onTagToggle={library.toggleTag}
          onDelete={library.remove}
          onRetry={(item) => void library.retry(item)}
          onClearFilters={library.clearFilters}
        />
      </div>

      <Pagination
        page={library.page}
        pageCount={data.pageCount}
        onPageChange={library.goToPage}
        label="Saved items pages"
      />
    </section>
  );
}
