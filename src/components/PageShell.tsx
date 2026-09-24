import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  /** Narrower column for reading views. */
  narrow?: boolean;
}

/** Layout for the secondary library pages: "← Back", a heading, then content. */
export function PageShell({ title, description, children, narrow = false }: PageShellProps) {
  return (
    <div className={`mx-auto px-4 pb-16 pt-8 sm:px-6 sm:pt-12 ${narrow ? "max-w-3xl" : "max-w-6xl"}`}>
      <nav aria-label="Breadcrumb">
        <Link href="/" className="btn-ghost -ml-2.5">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </Link>
      </nav>
      <header className="mb-8 mt-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{title}</h1>
        <p className="mt-2 text-fg-muted">{description}</p>
      </header>
      {children}
    </div>
  );
}

function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

/** Placeholder for /items while the first page loads. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading saved items" className="flex flex-col gap-6">
      <Bar className="h-11 w-full rounded-lg" />
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="card overflow-hidden">
            <div className="aspect-[16/9] w-full animate-pulse border-b border-line bg-muted" />
            <div className="space-y-3 p-4 sm:p-5">
              <Bar className="h-3 w-1/3" />
              <Bar className="h-5 w-5/6" />
              <Bar className="h-3.5 w-full" />
              <Bar className="h-3.5 w-2/3" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Placeholder for /summaries while the first page loads. */
export function SummaryListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading summaries" className="flex flex-col gap-6">
      <Bar className="h-11 w-full rounded-lg" />
      <ul className="flex flex-col gap-5" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="card space-y-3 p-5 sm:p-6">
            <Bar className="h-3 w-1/4" />
            <Bar className="h-6 w-3/4" />
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-1/2" />
          </li>
        ))}
      </ul>
    </div>
  );
}
