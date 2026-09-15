import { z } from "zod";

/**
 * Single source of truth for the shape of data crossing the frontend/backend
 * boundary. Both the API route handlers and the client components import
 * these same schemas/types, so a change to the contract is a compile error
 * on both sides instead of a silent runtime mismatch.
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
  summary: z.string().nullable(),
  tags: z.array(z.string()),
  status: ItemStatusSchema,
  errorMessage: z.string().nullable(),
  createdAt: z.string(), // ISO string over the wire
  updatedAt: z.string(),
});
export type ItemDto = z.infer<typeof ItemDtoSchema>;

export const CreateItemRequestSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "URL is required")
    .url("Enter a valid URL, including https://"),
});
export type CreateItemRequest = z.infer<typeof CreateItemRequestSchema>;

export const CreateItemResponseSchema = z.object({
  item: ItemDtoSchema,
  cached: z.boolean(),
});
export type CreateItemResponse = z.infer<typeof CreateItemResponseSchema>;

export const ListItemsQuerySchema = z.object({
  query: z.string().trim().optional(),
  tag: z.string().trim().optional(),
});
export type ListItemsQuery = z.infer<typeof ListItemsQuerySchema>;

export const ListItemsResponseSchema = z.object({
  items: z.array(ItemDtoSchema),
  availableTags: z.array(z.string()),
});
export type ListItemsResponse = z.infer<typeof ListItemsResponseSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
