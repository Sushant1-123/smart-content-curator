import { z } from "zod";

/**
 * Single source of truth for the shape of data crossing the frontend/backend
 * boundary. The API route handlers validate input with these schemas, and
 * the typed client in `lib/apiClient.ts` validates every response with them,
 * so a contract change is a compile error on both sides instead of a silent
 * runtime mismatch.
 */

export const ItemStatusSchema = z.enum(["PENDING", "READY", "PARTIAL", "FAILED"]);
export type ItemStatus = z.infer<typeof ItemStatusSchema>;

export const ItemDtoSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  siteName: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  summary: z.string().nullable(),
  tags: z.array(z.string()),
  status: ItemStatusSchema,
  errorMessage: z.string().nullable(),
  createdAt: z.string(), // ISO string over the wire
  updatedAt: z.string(),
});
export type ItemDto = z.infer<typeof ItemDtoSchema>;

// --- POST /api/items -------------------------------------------------------

export const CreateItemRequestSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "URL is required")
    .max(2048, "URL is too long")
    .url("Enter a valid URL, including https://"),
});
export type CreateItemRequest = z.infer<typeof CreateItemRequestSchema>;

export const CreateItemResponseSchema = z.object({
  item: ItemDtoSchema,
  /** True when the URL was already saved and no external calls were made. */
  cached: z.boolean(),
});
export type CreateItemResponse = z.infer<typeof CreateItemResponseSchema>;

// --- GET /api/items --------------------------------------------------------

export const SORT_OPTIONS = ["newest", "oldest"] as const;
export const SortSchema = z.enum(SORT_OPTIONS);
export type SortOrder = z.infer<typeof SortSchema>;

export const TAG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_FILTER_TAGS = 10;

const TagSchema = z.string().trim().toLowerCase().max(40).regex(TAG_PATTERN, "Invalid tag");

/**
 * Query-string contract. `tags` arrives as a comma-separated string
 * (`?tags=react,frontend`) and is parsed into a deduplicated array; an item
 * must carry every selected tag to match (AND semantics).
 */
export const ListItemsQuerySchema = z.object({
  q: z.string().trim().max(200, "Search is too long").optional().default(""),
  tags: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? Array.from(new Set(value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)))
        : [],
    )
    .pipe(z.array(TagSchema).max(MAX_FILTER_TAGS, `Select at most ${MAX_FILTER_TAGS} tags`)),
  sort: SortSchema.optional().default("newest"),
});
export type ListItemsQuery = z.output<typeof ListItemsQuerySchema>;

export const TagCountSchema = z.object({ name: z.string(), count: z.number().int() });
export type TagCount = z.infer<typeof TagCountSchema>;

export const ListItemsResponseSchema = z.object({
  items: z.array(ItemDtoSchema),
  /** Every tag in the library with its item count (not just the filtered set). */
  tags: z.array(TagCountSchema),
  /** Total items in the library, so the UI can render "3 of 12". */
  total: z.number().int(),
});
export type ListItemsResponse = z.infer<typeof ListItemsResponseSchema>;

// --- /api/items/:id --------------------------------------------------------

export const ItemIdSchema = z.string().trim().min(1).max(64).regex(/^[a-z0-9]+$/i, "Invalid id");

export const RetryItemResponseSchema = z.object({ item: ItemDtoSchema });
export type RetryItemResponse = z.infer<typeof RetryItemResponseSchema>;

export const DeleteItemResponseSchema = z.object({ deleted: z.literal(true), id: z.string() });
export type DeleteItemResponse = z.infer<typeof DeleteItemResponseSchema>;

// --- Errors ----------------------------------------------------------------

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "INVALID_JSON",
  "INVALID_URL",
  "NOT_FOUND",
  "RATE_LIMITED",
  "UPSTREAM_ERROR",
  "INTERNAL_ERROR",
] as const;
export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    code: ErrorCodeSchema,
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
