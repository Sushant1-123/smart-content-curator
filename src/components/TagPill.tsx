"use client";

interface TagPillProps {
  tag: string;
  active?: boolean;
  onClick?: (tag: string) => void;
}

export function TagPill({ tag, active, onClick }: TagPillProps) {
  const isInteractive = typeof onClick === "function";
  return (
    <button
      type="button"
      disabled={!isInteractive}
      onClick={() => onClick?.(tag)}
      className={[
        "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-brand-600 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200",
        isInteractive ? "cursor-pointer" : "cursor-default",
      ].join(" ")}
      aria-pressed={active}
    >
      #{tag}
    </button>
  );
}
