import { useEffect } from "react";

const SELECTORS = [
  "#lovable-badge",
  "[data-lovable-badge]",
  "lovable-badge",
  'a[href*="lovable.dev"]',
  'a[href*="lovable.app"]',
  '[class*="lovable-badge"]',
  'iframe[src*="lovable"]',
];

const STYLE_ID = "lovable-badge-guard";

/** Permanently hides and purges any external editor badge from the store. */
export function LovableBadgeGuard() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const existing = document.getElementById(STYLE_ID);
    const style = existing ?? document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `${SELECTORS.join(",")}{display:none !important;visibility:hidden !important;opacity:0 !important;pointer-events:none !important;clip:rect(0,0,0,0) !important;width:0 !important;height:0 !important;}`;
    if (!existing) document.head.appendChild(style);

    const sweep = () => {
      SELECTORS.forEach((sel) => {
        document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
          el.remove();
        });
      });
    };
    sweep();

    let scheduled = 0;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = window.requestAnimationFrame(() => {
        scheduled = 0;
        sweep();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (scheduled) window.cancelAnimationFrame(scheduled);
      observer.disconnect();
    };
  }, []);

  return null;
}
