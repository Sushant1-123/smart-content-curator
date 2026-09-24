import type { z } from "zod";
import {
  ApiErrorSchema,
  CreateItemResponseSchema,
  DeleteItemResponseSchema,
  ListItemsResponseSchema,
  RetryItemResponseSchema,
  type CreateItemRequest,
  type CreateItemResponse,
  type DeleteItemResponse,
  type ErrorCode,
  type ListItemsResponse,
  type RetryItemResponse,
  type SortOrder,
} from "@/types/api";

/**
 * Typed browser client for the REST API. Every response body is validated
 * against the same Zod schema the server uses, so the UI never trusts an
 * unchecked shape.
 */

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: ErrorCode | "NETWORK_ERROR",
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<S extends z.ZodTypeAny>(
  schema: S,
  input: string,
  init?: RequestInit,
): Promise<z.output<S>> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new ApiClientError("Network error. Check your connection and try again.", 0, "NETWORK_ERROR");
  }

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(json);
    throw parsed.success
      ? new ApiClientError(parsed.data.error.message, res.status, parsed.data.error.code)
      : new ApiClientError(`Request failed (HTTP ${res.status})`, res.status, "INTERNAL_ERROR");
  }
  return schema.parse(json);
}

export interface ListParams {
  q: string;
  tags: readonly string[];
  sort: SortOrder;
  page: number;
}

/** Builds the query string shared by the API and the page URL (defaults are left out). */
export function buildListSearchParams({ q, tags, sort, page }: ListParams): URLSearchParams {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (tags.length) params.set("tags", tags.join(","));
  if (sort !== "newest") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  return params;
}

export const api = {
  listItems(params: ListParams, limit: number, signal?: AbortSignal): Promise<ListItemsResponse> {
    const qs = buildListSearchParams(params);
    qs.set("limit", String(limit));
    return request(ListItemsResponseSchema, `/api/items?${qs}`, { signal });
  },

  createItem(body: CreateItemRequest): Promise<CreateItemResponse> {
    return request(CreateItemResponseSchema, "/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  retryItem(id: string): Promise<RetryItemResponse> {
    return request(RetryItemResponseSchema, `/api/items/${encodeURIComponent(id)}/retry`, {
      method: "POST",
    });
  },

  deleteItem(id: string, options: { keepalive?: boolean } = {}): Promise<DeleteItemResponse> {
    return request(DeleteItemResponseSchema, `/api/items/${encodeURIComponent(id)}`, {
      method: "DELETE",
      keepalive: options.keepalive,
    });
  },
};
