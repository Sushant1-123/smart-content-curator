import type { ItemStatus } from "@/types/api";

const STYLES: Record<ItemStatus, { label: string; className: string }> = {
  PENDING: { label: "Saving…", className: "bg-amber-100 text-amber-700" },
  READY: { label: "Ready", className: "bg-emerald-100 text-emerald-700" },
  PARTIAL: { label: "Summary failed", className: "bg-orange-100 text-orange-700" },
  FAILED: { label: "Fetch failed", className: "bg-red-100 text-red-700" },
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  if (status === "READY") return null;
  const style = STYLES[status];
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}
