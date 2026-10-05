import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMetaPublicConfig } from "@/lib/meta/meta.functions";
import { initMetaPixel, trackMetaEvent } from "@/lib/meta/pixel";

export function MetaPixelTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: config } = useQuery({
    queryKey: ["meta-public-config"],
    queryFn: () => getMetaPublicConfig(),
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (config?.pixel_id) {
      initMetaPixel(config.pixel_id);
    }
  }, [config?.pixel_id]);

  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (!config?.pixel_id || typeof window === "undefined") return;
    if (pathname.startsWith("/admin")) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    void trackMetaEvent("PageView");
  }, [pathname, config?.pixel_id]);

  return null;
}
