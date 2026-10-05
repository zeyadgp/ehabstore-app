import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOrders, type Order } from "@/lib/admin";

const READ_KEY = "ehab-read-orders";
const EVT = "ehab-read-orders-changed";
const EMPTY_READ_IDS: string[] = [];
const getServerSnapshot = () => EMPTY_READ_IDS;

function load(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(READ_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

let cache: string[] | null = null;

function current(): string[] {
  if (!cache) cache = load();
  return cache;
}

function save(ids: string[]) {
  cache = ids.slice(-400);
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(cache));
  } catch {
    /* التخزين المحلي اختياري */
  }
  window.dispatchEvent(new Event(EVT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  return () => window.removeEventListener(EVT, cb);
}

/** تنبيه صوتي خفيف بدون أي مكتبة خارجية. */
function beep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1180, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.42);
    osc.onended = () => void ctx.close();
  } catch {
    /* الصوت اختياري */
  }
}

/**
 * إشعارات الطلبات الجديدة داخل لوحة التحكم:
 * تعتمد على بيانات الطلبات الحالية، مع تتبّع المقروء محلياً وصوت لمرة واحدة لكل طلب.
 */
export function useOrderAlerts() {
  const qc = useQueryClient();
  const { data: orders = [] } = useOrders();
  const read = useSyncExternalStore(subscribe, current, getServerSnapshot);
  const [ready, setReady] = useState(false);
  const heard = useRef<Set<string>>(new Set());

  useEffect(() => {
    setReady(true);
    const t = setInterval(
      () => void qc.invalidateQueries({ queryKey: ["admin", "orders"] }),
      30_000,
    );
    return () => clearInterval(t);
  }, [qc]);

  const unread: Order[] = ready
    ? orders.filter((o) => o.status === "new" && !read.includes(o.id))
    : [];

  useEffect(() => {
    if (!ready) return;
    const ids = unread.map((o) => o.id);
    if (heard.current.size === 0) {
      ids.forEach((id) => heard.current.add(id));
      return;
    }
    const fresh = ids.filter((id) => !heard.current.has(id));
    if (fresh.length > 0) beep();
    ids.forEach((id) => heard.current.add(id));
  }, [ready, unread.map((o) => o.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = useCallback((id: string) => {
    if (current().includes(id)) return;
    save([...current(), id]);
  }, []);

  const markAllRead = useCallback(() => {
    const ids = new Set(current());
    orders.filter((o) => o.status === "new").forEach((o) => ids.add(o.id));
    save([...ids]);
  }, [orders]);

  return { unread, count: unread.length, markRead, markAllRead };
}
