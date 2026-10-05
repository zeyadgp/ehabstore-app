import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";
import { setSharedQueryClient } from "@/lib/offline-catalog";

export const getRouter = () => {
  // Tuned for slow / unstable mobile networks: keep data fresh enough,
  // retry once on a dropped request, and avoid noisy refetches.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        retry: 1,
        retryDelay: 800,
        refetchOnWindowFocus: false,
      },
    },
  });

  setSharedQueryClient(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 0,
  });

  // يُرسل بيانات الخادم مع الصفحة حتى لا يختلف العرض عند فتحها في المتصفح.
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
};
