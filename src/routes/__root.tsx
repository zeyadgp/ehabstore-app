import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "sonner";
import { CartProvider } from "@/lib/cart";
import { CurrencyProvider } from "@/lib/currency";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AppNav } from "@/components/AppNav";
import { ThemeProvider, themeCss, themesQuery, type Theme } from "@/lib/theme";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { StoreAssistantWidget } from "@/components/StoreAssistantWidget";
import { LovableBadgeGuard } from "@/components/LovableBadgeGuard";
import { AppIcons } from "@/components/AppIcons";
import { SplashScreen } from "@/components/SplashScreen";
import { MetaPixelTracker } from "@/components/MetaPixelTracker";
import { VisitorTracker } from "@/components/VisitorTracker";
import { initSilentBackgroundSync } from "@/lib/offline-catalog";
import "@/lib/supabase-diagnostic";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Loading the active theme here lets the server paint the right colours
  // in the very first HTML — no default-gold flash before hydration.
  loader: async ({ context }) => {
    try {
      const themes = await context.queryClient.ensureQueryData(themesQuery);
      const active = themes.find((t) => t.is_default) ?? themes[0] ?? null;
      return { theme: active as Theme | null };
    } catch {
      return { theme: null as Theme | null };
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      {
        name: "theme-color",
        content: (loaderData as any)?.theme?.background_color ?? "#c9a227",
      },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "إيهاب ستور" },
      { title: "إيهاب ستور — منتجات أصلية للعناية بالبشرة والشعر والعطور" },
      {
        name: "description",
        content: "منتجات أصلية للعناية بالبشرة والشعر والمكياج والعطور مع توصيل سريع.",
      },
      {
        name: "google-site-verification",
        content: "xAqLHm7aZMpn_yeZx7Kjngo4Ut7C78or6ginbyUMs6A",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "إيهاب ستور للعناية والتجميل" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "shortcut icon", href: "/favicon.png", type: "image/png" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: import.meta.env["VITE_SUPABASE_URL"] as string,
        crossOrigin: "anonymous",
      },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&family=El+Messiri:wght@600&display=swap",
      },
    ],
    styles: (loaderData as any)?.theme ? [{ children: themeCss((loaderData as any).theme) }] : [],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get("ref");
      if (ref && ref.trim()) {
        localStorage.setItem("ehab_referred_by", ref.trim().toUpperCase());
      }
    } catch {
      /* ignore */
    }

    // تهيئة نظام المزامنة الصامتة في الخلفية بدون أي إشعارات أو مؤشرات تحميل
    initSilentBackgroundSync(queryClient);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CurrencyProvider>
          <CartProvider>
            {inAdmin ? (
              <div className="flex min-h-[100svh] flex-col bg-background text-foreground">
                <Outlet />
              </div>
            ) : (
              <div className="flex min-h-[100svh] flex-col overflow-x-hidden">
                <Header />
                <main className="flex-1 pb-24 md:pb-8">
                  {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
                  <Outlet />
                </main>
                <Footer />
              </div>
            )}
            {!inAdmin && <WhatsAppButton />}
            {!inAdmin && <StoreAssistantWidget />}
            {!inAdmin && <AppNav />}
            <AppIcons />
            {!inAdmin && <SplashScreen />}
            {!inAdmin && <LovableBadgeGuard />}
            <MetaPixelTracker />
            <VisitorTracker />
            <Toaster position="top-center" richColors dir="rtl" />
          </CartProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
