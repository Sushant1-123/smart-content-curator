"use client";

import { useState } from "react";
import { hueFromString } from "@/lib/format";

interface FaviconProps {
  src: string | null;
  hostname: string;
  className?: string;
}

/** Site icon with a lettered fallback when the icon is missing or fails to load. */
export function Favicon({ src, hostname, className = "h-4 w-4" }: FaviconProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        className={`${className} inline-flex shrink-0 items-center justify-center rounded text-[9px] font-bold uppercase text-white`}
        style={{ backgroundColor: `hsl(${hueFromString(hostname)} 45% 45%)` }}
      >
        {hostname.charAt(0)}
      </span>
    );
  }

  return (
    // Third-party icons on arbitrary domains: next/image would need an open
    // remotePatterns allowlist, so a plain lazy <img> is used instead.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} shrink-0 rounded-sm object-contain`}
    />
  );
}
