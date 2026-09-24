"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "light" | "dark" | "system";
const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };

function readStoredTheme(): Theme {
  try {
    const value = localStorage.getItem("theme");
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme: Theme): void {
  const dark =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Cycles system → light → dark. The initial class is set by the inline script in layout.tsx. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme ?? "system") + 1) % ORDER.length] ?? "system";
    setTheme(next);
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      // Storage unavailable (private mode) — theme still applies for this visit.
    }
    applyTheme(next);
  }

  const current = theme ?? "system";
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;
  const nextLabel = LABEL[ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? "system"];

  return (
    <button
      type="button"
      onClick={cycle}
      className="icon-btn"
      aria-label={`${LABEL[current]} (switch to ${nextLabel.toLowerCase()})`}
      title={LABEL[current]}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </button>
  );
}
