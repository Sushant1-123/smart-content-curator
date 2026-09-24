"use client";

import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import type { ItemDto, ListItemsResponse } from "@/types/api";
import type { ListParams } from "@/lib/apiClient";
import { PAGE_SIZE } from "@/lib/pagination";
import { useItemsLibrary } from "@/lib/useItemsLibrary";
import { FullSummary, ItemMeta, OpenOriginalLink, TagList, itemTitle } from "./SummaryParts";
import { NoResults } from "./ItemList";
import { ListError } from "./ListError";
import { Pagination } from "./Pagination";
import { SearchField } from "./SearchField";

interface SummariesBoardProps {
  initialData: ListItemsResponse;
  initialParams: ListParams;
}

/** /summaries: a reading view of every saved summary, newest first, 15 per page. */
export function SummariesBoard({ initialData, initialParams }: SummariesBoardProps) {
  const library = useItemsLibrary({ initialData, initialParams, limit: PAGE_SIZE });
  const { data, query } = library;
  const items = data.items;
  const searching = query.trim().length > 0;

  if (data.total === 0 && !searching) return <NoSummaries />;

  return (
    <section aria-label="Saved summaries" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SearchField
          ref={library.searchRef}
          id="summary-search"
          label="Search summaries"
          placeholder="Search titles, summaries and tags"
          value={query}
          onChange={library.setQuery}
          isLoading={library.isLoading}
        />
        <p className="border-b border-line pb-3 text-sm text-fg-muted" aria-live="polite" aria-atomic="true">
          {searching || items.length < data.matched ? (
            <>
              Showing <strong className="font-semibold text-fg">{items.length}</strong> of {data.matched}{" "}
              {data.matched === 1 ? "summary" : "summaries"}
              {searching && (
                <>
                  {" "}
                  matching “<strong className="font-semibold text-fg">{query.trim()}</strong>”
                </>
              )}
            </>
          ) : (
            <>
              <strong className="font-semibold text-fg">{data.matched}</strong> {data.matched === 1 ? "summary" : "summaries"}
            </>
          )}
        </p>
      </div>

      {library.listError && <ListError message={library.listError} onRetry={() => void library.reload()} />}

      {items.length === 0 ? (
        <NoResults
          onClear={() => library.setQuery("")}
          title="No summaries match your search"
          hint="Try a different keyword."
          clearLabel="Clear search"
        />
      ) : (
        <ol className={`flex flex-col gap-5 transition-opacity duration-200 ${library.isLoading ? "opacity-60" : "opacity-100"}`}>
          {items.map((item) => (
            <li key={item.id}>
              <SummaryBlock item={item} busy={library.busyIds.has(item.id)} onRetry={(i) => void library.retry(i)} />
            </li>
          ))}
        </ol>
      )}

      <Pagination page={library.page} pageCount={data.pageCount} onPageChange={library.goToPage} label="Summary pages" />
    </section>
  );
}

function SummaryBlock({ item, busy, onRetry }: { item: ItemDto; busy: boolean; onRetry: (item: ItemDto) => void }) {
  const titleId = `summary-title-${item.id}`;
  return (
    <article aria-labelledby={titleId} aria-busy={busy} className="card flex flex-col gap-4 p-5 sm:p-6">
      <div>
        <ItemMeta item={item} className="text-sm" />
        <h2 id={titleId} className="mt-2 font-display text-xl font-semibold leading-snug tracking-tight text-fg sm:text-2xl">
          {itemTitle(item)}
        </h2>
      </div>
      <FullSummary item={item} busy={busy} onRetry={onRetry} />
      <TagList tags={item.tags} />
      <div className="border-t border-line pt-4">
        <OpenOriginalLink item={item} className="w-full sm:w-auto" />
      </div>
    </article>
  );
}

function NoSummaries() {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center sm:py-20">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-fg">
        <FileText className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight">No summaries yet</h2>
      <p className="mt-2 max-w-md text-fg-muted">Save a link and its AI summary will show up here.</p>
      <Link href="/" className="btn-primary mt-6">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Save your first link
      </Link>
    </div>
  );
}
