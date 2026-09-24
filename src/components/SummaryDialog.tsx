"use client";

import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type RefObject } from "react";
import { X } from "lucide-react";
import type { ItemDto } from "@/types/api";
import { FullSummary, ItemMeta, OpenOriginalLink, TagList, itemTitle } from "./SummaryParts";

interface SummaryDialogProps {
  /** The item to show; `null` closes the dialog. */
  item: ItemDto | null;
  busy: boolean;
  onRetry: (item: ItemDto) => void;
  onClose: () => void;
  /** Focus goes back here when the dialog closes (the card's Summary button). */
  returnFocusRef: RefObject<HTMLElement>;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible summary modal on the native <dialog> (top layer, inert
 * background, Esc to close). A bottom sheet on phones, centred from `sm`.
 * Tab is wrapped so focus never leaves the dialog.
 */
export function SummaryDialog({ item, busy, onRetry, onClose, returnFocusRef }: SummaryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Keep showing the last item while the dialog animates closed.
  const shown = useRef<ItemDto | null>(null);
  if (item) shown.current = item;
  const content = shown.current;
  const isOpen = item !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Stop the page behind from scrolling while the dialog is open.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  function handleClose() {
    onClose();
    // Next frame, so it wins over the browser's own focus restore (Safari doesn't focus clicked buttons).
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }

  // A click on the <dialog> itself (not its content) is a click on the backdrop.
  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) event.currentTarget.close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusables = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-labelledby="summary-dialog-title"
      className="m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-hidden rounded-t-2xl border border-line bg-surface p-0 text-fg shadow-card-hover backdrop:bg-black/50 backdrop:backdrop-blur-[2px] open:animate-toast-in sm:m-auto sm:max-h-[85vh] sm:max-w-xl sm:rounded-2xl"
    >
      {content && (
        <div className="flex max-h-[inherit] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 pb-4 pt-5 sm:px-6">
            <div className="min-w-0">
              <ItemMeta item={content} />
              <h2 id="summary-dialog-title" className="mt-2 font-display text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
                {itemTitle(content)}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="icon-btn -mr-2 -mt-1 shrink-0"
              aria-label="Close summary"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-col gap-5 overflow-y-auto px-5 py-5 sm:px-6">
            <section aria-labelledby="summary-dialog-heading" className="flex flex-col gap-2">
              <h3 id="summary-dialog-heading" className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                AI summary
              </h3>
              <FullSummary item={content} busy={busy} onRetry={onRetry} />
            </section>
            <TagList tags={content.tags} />
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <button type="button" onClick={() => dialogRef.current?.close()} className="btn-secondary">
              Close
            </button>
            <OpenOriginalLink item={content} />
          </div>
        </div>
      )}
    </dialog>
  );
}
