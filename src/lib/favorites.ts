import { useCallback, useEffect, useState } from "react";

const KEY = "ehab-favorites";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    setIds(read());
    const sync = () => {
      if (mounted) setIds(read());
    };
    window.addEventListener("ehab-favorites-change", sync);
    return () => {
      mounted = false;
      window.removeEventListener("ehab-favorites-change", sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const next = read().includes(id) ? read().filter((x) => x !== id) : [...read(), id];
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("ehab-favorites-change"));
    return next.includes(id);
  }, []);

  return { ids, isFavorite: (id: string) => ids.includes(id), toggle };
}
