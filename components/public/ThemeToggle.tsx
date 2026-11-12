"use client";

import { useEffect, useRef, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const preference = useRef<string | null>(null);
  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    try { const saved = localStorage.getItem("vibe-log-theme"); if (saved === "light" || saved === "dark") preference.current = saved; } catch { /* Appearance still works without storage. */ }
    function apply(value: string) { document.documentElement.dataset.theme = value; setDark(value === "dark"); }
    apply(preference.current || (system.matches ? "dark" : "light"));
    function followSystem(event: MediaQueryListEvent) { if (!preference.current) apply(event.matches ? "dark" : "light"); }
    system.addEventListener("change", followSystem);
    return () => system.removeEventListener("change", followSystem);
  }, []);
  function toggle() {
    const theme = dark ? "light" : "dark";
    preference.current = theme;
    setDark(!dark);
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("vibe-log-theme", theme); } catch { /* Keep appearance for this visit. */ }
  }
  return <button id="theme-toggle" type="button" aria-pressed={dark} onClick={toggle}>Dark mode</button>;
}
