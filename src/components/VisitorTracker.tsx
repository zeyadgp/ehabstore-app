import { useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";

const SESSION_KEY = "ehab-visitor-id";

function sessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

/** يتتبع زيارات صفحات المتجر ويرسلها للخادم مرة واحدة لكل صفحة في الجلسة */
export function VisitorTracker() {
  const { pathname } = useLocation();
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    if (seenRef.current.has(pathname)) return;
    seenRef.current.add(pathname);
    const payload = JSON.stringify({
      path: pathname,
      referrer: document.referrer || "",
      sessionId: sessionId(),
    });
    void fetch("/api/public/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
