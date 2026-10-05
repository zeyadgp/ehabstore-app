import { useEffect, useState } from "react";

export const COLOR_MODE_KEY = "ehab-dark-mode";

function storedMode(): boolean {
  if (typeof window === "undefined") return false;
  const saved = window.localStorage.getItem(COLOR_MODE_KEY);
  if (saved !== null) return saved === "true";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function applyColorMode(dark: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function useColorMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const dark = storedMode();
    setIsDark(dark);
    applyColorMode(dark);
  }, []);

  const toggle = () => {
    setIsDark((current) => {
      const next = !current;
      window.localStorage.setItem(COLOR_MODE_KEY, String(next));
      applyColorMode(next);
      window.dispatchEvent(new CustomEvent("color-mode-changed", { detail: { dark: next } }));
      return next;
    });
  };

  return { isDark, toggle };
}
