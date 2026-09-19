export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Item not found</h1>
      <p className="mt-2 text-sm text-slate-500">
        This saved item doesn&apos;t exist or may have been removed.
      </p>
      <a href="/" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
        ← Back to all items
      </a>
    </div>
  );
}
