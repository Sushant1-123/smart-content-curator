import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Site-wide Open Graph / Twitter card image, generated at build time. */
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
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "#4f46e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 40,
              fontWeight: 700,
            }}
          >
            ✦
          </div>
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
