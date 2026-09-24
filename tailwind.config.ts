import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

/** Colour tokens are CSS variables (see globals.css) so light/dark share one palette. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        muted: token("muted"),
        line: token("line"),
        "line-strong": token("line-strong"),
        fg: token("fg"),
        "fg-muted": token("fg-muted"),
        "fg-subtle": token("fg-subtle"),
        accent: token("accent"),
        "accent-hover": token("accent-hover"),
        "accent-fg": token("accent-fg"),
        "accent-soft": token("accent-soft"),
        "accent-soft-fg": token("accent-soft-fg"),
        danger: token("danger"),
        "danger-soft": token("danger-soft"),
        "danger-soft-fg": token("danger-soft-fg"),
        warning: token("warning"),
        "warning-soft": token("warning-soft"),
        "warning-soft-fg": token("warning-soft-fg"),
        success: token("success"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-display)", ...defaultTheme.fontFamily.serif],
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 1px 3px rgb(0 0 0 / 0.06)",
        "card-hover": "0 4px 12px rgb(0 0 0 / 0.08), 0 2px 4px rgb(0 0 0 / 0.04)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "highlight-ring": {
          "0%, 60%": { boxShadow: "0 0 0 3px rgb(var(--accent) / 0.55)" },
          "100%": { boxShadow: "0 0 0 3px rgb(var(--accent) / 0)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "toast-in": "toast-in 180ms ease-out",
        "highlight-ring": "highlight-ring 2.4s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
