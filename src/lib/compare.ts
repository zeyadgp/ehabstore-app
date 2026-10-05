import { useSyncExternalStore } from "react";

/** قائمة مقارنة المنتجات (محفوظة محلياً، بحد أقصى 4 منتجات). */
const KEY = "ehab-compare-v1";
export const COMPARE_MAX = 4;

const emptyIds: string[] = [];
let cachedRaw: string | null = null;
let cachedSnapshot: string[] = emptyIds;

const read = (): string[] => {
  if (typeof window === "undefined") return emptyIds;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === cachedRaw) return cachedSnapshot;
    cachedRaw = raw;
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    cachedSnapshot = Array.isArray(list)
      ? (list.filter((x) => typeof x === "string") as string[])
      : emptyIds;
    return cachedSnapshot;
  } catch {
    return emptyIds;
  }
};

const listeners = new Set<() => void>();

function write(ids: string[]) {
  try {
    const str = JSON.stringify(ids);
    cachedRaw = str;
    cachedSnapshot = ids;
    window.localStorage.setItem(KEY, str);
  } catch {
    /* التخزين اختياري */
  }
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function toggleCompare(id: string): { ids: string[]; added: boolean; full: boolean } {
  const ids = read();
  if (ids.includes(id)) {
    const next = ids.filter((x) => x !== id);
    write(next);
    return { ids: next, added: false, full: false };
  }
  if (ids.length >= COMPARE_MAX) return { ids, added: false, full: true };
  const next = [...ids, id];
  write(next);
  return { ids: next, added: true, full: false };
}

export function clearCompare() {
  write([]);
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cachedRaw = null;
      callback();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getServerSnapshot(): string[] {
  return emptyIds;
}

export function useCompare(): string[] {
  return useSyncExternalStore(subscribe, read, getServerSnapshot);
}
