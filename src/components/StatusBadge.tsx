import type { ItemStatus } from "@/types/api";

const STYLES: Record<Exclude<ItemStatus, "READY">, { label: string; className: string }> = {
  PENDING: { label: "Summarising…", className: "bg-accent-soft text-accent-soft-fg" },
  PARTIAL: { label: "Summary failed", className: "bg-warning-soft text-warning-soft-fg" },
  FAILED: { label: "Fetch failed", className: "bg-danger-soft text-danger-soft-fg" },
};

/** Small status pill; renders nothing for READY items. */
export function StatusBadge({ status }: { status: ItemStatus }) {
  if (status === "READY") return null;
  const style = STYLES[status];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}
