"use client";

import { useState } from "react";
import { hueFromString } from "@/lib/format";
import { Favicon } from "./Favicon";

interface ThumbnailProps {
  src: string | null;
  hostname: string;
  faviconUrl: string | null;
  className?: string;
}

/**
 * Card image. Falls back to generated artwork (a per-domain gradient with the
 * site's icon) when there's no og:image or it fails to load, so every card
 * keeps the same shape.
 */
export function Thumbnail({ src, hostname, faviconUrl, className = "" }: ThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const hue = hueFromString(hostname);

  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        className={`thumb-fallback relative flex items-center justify-center overflow-hidden ${className}`}
        style={{ "--hue": hue } as React.CSSProperties}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/90 shadow-sm">
            <Favicon src={faviconUrl} hostname={hostname} className="h-7 w-7" />
          </span>
          <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium text-stone-700 dark:bg-black/40 dark:text-stone-200">{hostname}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-muted ${className}`}>
      {/* See Favicon.tsx for why this is a plain <img>. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
    </div>
  );
}
