import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Edge bundles the default font as an asset; the Node build resolves it with
// fileURLToPath, which breaks on project paths containing "(" or spaces.
export const runtime = "edge";

/** Site-wide Open Graph / Twitter card image (1200×630), rendered on request and CDN-cached. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "linear-gradient(135deg, #fafaf9 0%, #eef2ff 100%)",
          color: "#1c1917",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="9" fill="#4f46e5" />
            <path
              d="M11 8.5h10a1.5 1.5 0 0 1 1.5 1.5v14.2a.8.8 0 0 1-1.25.66L16 21.3l-5.25 3.56A.8.8 0 0 1 9.5 24.2V10A1.5 1.5 0 0 1 11 8.5Z"
              fill="#fff"
            />
            <path d="M16 11.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="#4f46e5" />
          </svg>
          <div style={{ fontSize: 36, fontWeight: 600 }}>{SITE_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
            Read smarter, not longer.
          </div>
          <div style={{ fontSize: 32, color: "#57534e" }}>
            Save any link. AI summarises it and tags it by topic.
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {["ai-summaries", "smart-tags", "instant-search"].map((tag) => (
            <div
              key={tag}
              style={{
                padding: "10px 22px",
                borderRadius: 999,
                background: "#e0e7ff",
                color: "#3730a3",
                fontSize: 24,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
