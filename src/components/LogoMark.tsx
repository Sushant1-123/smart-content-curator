/** Bookmark + spark mark; shares its drawing with app/icon.svg. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" className="fill-accent" />
      <path
        d="M11 8.5h10a1.5 1.5 0 0 1 1.5 1.5v14.2a.8.8 0 0 1-1.25.66L16 21.3l-5.25 3.56A.8.8 0 0 1 9.5 24.2V10A1.5 1.5 0 0 1 11 8.5Z"
        className="fill-accent-fg"
      />
      <path d="M16 11.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" className="fill-accent" />
    </svg>
  );
}
