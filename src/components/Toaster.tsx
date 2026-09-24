"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export type ToastKind = "success" | "error" | "warning" | "info";

export interface ToastInput {
  kind: ToastKind;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  /** Milliseconds before auto-dismiss. Default 5000. */
  duration?: number;
}

interface Toast extends ToastInput {
  id: number;
}

interface ToastApi {
  toast: (input: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const ICONS = {
  success: <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />,
  error: <XCircle className="h-5 w-5 text-danger" aria-hidden="true" />,
  warning: <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />,
  info: <Info className="h-5 w-5 text-accent" aria-hidden="true" />,
} satisfies Record<ToastKind, JSX.Element>;

const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { ...input, id }].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section
        aria-label="Notifications"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} dismiss={dismiss} />
        ))}
      </section>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, dismiss }: { toast: Toast; dismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const { id } = toast;
  const onDismiss = useCallback(() => dismiss(id), [dismiss, id]);
  const duration = toast.duration ?? 5000;

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [paused, duration, onDismiss]);

  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="card pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 p-3.5 pr-2 shadow-card-hover"
    >
      <span className="mt-0.5 shrink-0">{ICONS[toast.kind]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 line-clamp-3 break-words text-sm text-fg-muted">{toast.description}</p>
        )}
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
          className="btn shrink-0 px-2.5 py-1.5 font-semibold text-accent hover:bg-accent-soft"
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" onClick={onDismiss} className="icon-btn h-8 w-8 shrink-0" aria-label="Dismiss notification">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
