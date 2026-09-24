"use client";

import { Check } from "lucide-react";

interface TagPillProps {
  tag: string;
  active?: boolean;
  count?: number;
  onToggle?: (tag: string) => void;
  size?: "sm" | "md";
}

/** A tag. Interactive (toggle button with aria-pressed) when `onToggle` is given. */
export function TagPill({ tag, active = false, count, onToggle, size = "sm" }: TagPillProps) {
  const base =
    "inline-flex items-center gap-1 rounded-full border font-medium transition-colors " +
    (size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm");
  const tone = active
    ? "border-accent bg-accent text-accent-fg hover:bg-accent-hover"
    : "border-line bg-muted/60 text-fg-muted hover:border-line-strong hover:bg-muted hover:text-fg";

  const content = (
    <>
      {active && <Check className="-ml-0.5 h-3.5 w-3.5" aria-hidden="true" />}
      <span>{tag}</span>
      {count !== undefined && (
        <span className={active ? "text-accent-fg/80" : "text-fg-subtle"}>
          <span className="sr-only">(</span>
          {count}
          <span className="sr-only"> items)</span>
        </span>
      )}
    </>
  );

  if (!onToggle) return <span className={`${base} ${tone}`}>{content}</span>;

  return (
    <button
      type="button"
      onClick={() => onToggle(tag)}
      aria-pressed={active}
      className={`${base} ${tone}`}
      title={active ? `Remove filter: ${tag}` : `Filter by ${tag}`}
    >
      {content}
    </button>
  );
}
