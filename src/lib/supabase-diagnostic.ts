/**
 * Supabase Connection & Permissions Diagnostic Utility
 * Verifies URL, API Key, table access permissions (RLS), and latency.
 * Logs structured diagnostic reports directly to the browser console.
 */
import { supabase } from "@/integrations/supabase/client";

export interface DiagnosticResult {
  timestamp: string;
  config: {
    hasUrl: boolean;
    urlValue: string;
    hasKey: boolean;
    keyType: "anon" | "service_role" | "unknown";
  };
  tables: {
    products: { accessible: boolean; count?: number; sampleId?: string; error?: string };
    categories: { accessible: boolean; count?: number; error?: string };
    store_settings: { accessible: boolean; exists?: boolean; error?: string };
    product_reviews: { accessible: boolean; count?: number; error?: string };
  };
  storage: {
    bucketAccessible: boolean;
    error?: string;
  };
  latencyMs: number;
  overallStatus: "healthy" | "partial" | "failed";
}

export async function runSupabaseDiagnostics(): Promise<DiagnosticResult> {
  const startTime = performance.now();
  const url =
    (import.meta.env["VITE_SUPABASE_URL"] as string) || "https://omjzyknkcisjmfvqokdj.supabase.co";
  const key = (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string) || "";

  const result: DiagnosticResult = {
    timestamp: new Date().toISOString(),
    config: {
      hasUrl: Boolean(url),
      urlValue: url ? url.replace(/https?:\/\//, "").split(".")[0] + "..." : "MISSING",
      hasKey: Boolean(key && key.length > 20),
      keyType: key.startsWith("eyJ") ? "anon" : "unknown",
    },
    tables: {
      products: { accessible: false },
      categories: { accessible: false },
      store_settings: { accessible: false },
      product_reviews: { accessible: false },
    },
    storage: {
      bucketAccessible: false,
    },
    latencyMs: 0,
    overallStatus: "healthy",
  };

  try {
    // 1. Test products table
    const {
      data: prodData,
      error: prodErr,
      count: prodCount,
    } = await supabase.from("products").select("id, name, status", { count: "exact" }).limit(2);

    if (prodErr) {
      result.tables.products = {
        accessible: false,
        error: `${prodErr.code || ""} ${prodErr.message}`,
      };
    } else {
      result.tables.products = {
        accessible: true,
        count: prodCount ?? prodData?.length ?? 0,
        ...(prodData?.[0]?.id ? { sampleId: prodData[0].id } : {}),
      };
    }
  } catch (err: unknown) {
    result.tables.products = {
      accessible: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    // 2. Test categories table
    const { error: catErr, count: catCount } = await supabase
      .from("categories")
      .select("id", { count: "exact", head: true });

    if (catErr) {
      result.tables.categories = {
        accessible: false,
        error: `${catErr.code || ""} ${catErr.message}`,
      };
    } else {
      result.tables.categories = {
        accessible: true,
        count: catCount ?? 0,
      };
    }
  } catch (err: unknown) {
    result.tables.categories = {
      accessible: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    // 3. Test store_settings table
    const { data: settData, error: settErr } = await supabase
      .from("store_settings")
      .select("id, store_name")
      .limit(1)
      .maybeSingle();

    if (settErr) {
      result.tables.store_settings = {
        accessible: false,
        error: `${settErr.code || ""} ${settErr.message}`,
      };
    } else {
      result.tables.store_settings = {
        accessible: true,
        exists: Boolean(settData),
      };
    }
  } catch (err: unknown) {
    result.tables.store_settings = {
      accessible: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    // 4. Test product_reviews table
    const { error: revErr, count: revCount } = await supabase
      .from("product_reviews")
      .select("id", { count: "exact", head: true });

    if (revErr) {
      result.tables.product_reviews = {
        accessible: false,
        error: `${revErr.code || ""} ${revErr.message}`,
      };
    } else {
      result.tables.product_reviews = {
        accessible: true,
        count: revCount ?? 0,
      };
    }
  } catch (err: unknown) {
    result.tables.product_reviews = {
      accessible: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    // 5. Test storage access
    const { data: storageData, error: storageErr } = await supabase.storage
      .from("store-images")
      .list("", { limit: 1 });

    if (storageErr) {
      result.storage = {
        bucketAccessible: false,
        error: `${storageErr.message}`,
      };
    } else {
      result.storage = {
        bucketAccessible: true,
      };
    }
  } catch (err: unknown) {
    result.storage = {
      bucketAccessible: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  result.latencyMs = Math.round(performance.now() - startTime);

  const anyFail =
    !result.tables.products.accessible ||
    !result.tables.categories.accessible ||
    !result.tables.store_settings.accessible;
  const allFail =
    !result.tables.products.accessible &&
    !result.tables.categories.accessible &&
    !result.tables.store_settings.accessible;

  result.overallStatus = allFail ? "failed" : anyFail ? "partial" : "healthy";

  // Console output
  const badgeColor =
    result.overallStatus === "healthy"
      ? "color: #10b981; font-weight: bold;"
      : result.overallStatus === "partial"
        ? "color: #f59e0b; font-weight: bold;"
        : "color: #ef4444; font-weight: bold;";

  console.groupCollapsed(
    `%c[Supabase Diagnostics] Status: ${result.overallStatus.toUpperCase()} (${result.latencyMs}ms)`,
    badgeColor,
  );
  console.log("Supabase Project:", result.config.urlValue);
  console.table({
    Products: {
      Accessible: result.tables.products.accessible ? "✅ YES" : "❌ NO",
      Count: result.tables.products.count ?? "N/A",
      Error: result.tables.products.error ?? "None",
    },
    Categories: {
      Accessible: result.tables.categories.accessible ? "✅ YES" : "❌ NO",
      Count: result.tables.categories.count ?? "N/A",
      Error: result.tables.categories.error ?? "None",
    },
    StoreSettings: {
      Accessible: result.tables.store_settings.accessible ? "✅ YES" : "❌ NO",
      Exists: result.tables.store_settings.exists ? "✅ YES" : "⚠️ None",
      Error: result.tables.store_settings.error ?? "None",
    },
    Reviews: {
      Accessible: result.tables.product_reviews.accessible ? "✅ YES" : "❌ NO",
      Count: result.tables.product_reviews.count ?? "N/A",
      Error: result.tables.product_reviews.error ?? "None",
    },
    Storage: {
      Accessible: result.storage.bucketAccessible ? "✅ YES" : "⚠️ Limited",
      Error: result.storage.error ?? "None",
    },
  });
  console.log("Full Report:", result);
  console.log("Tip: Run window.runSupabaseDiagnostics() at any time to re-test.");
  console.groupEnd();

  return result;
}

// Auto-run once in browser after idle
if (typeof window !== "undefined") {
  (
    window as unknown as { runSupabaseDiagnostics: typeof runSupabaseDiagnostics }
  ).runSupabaseDiagnostics = runSupabaseDiagnostics;

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => {
      void runSupabaseDiagnostics();
    });
  } else {
    setTimeout(() => {
      void runSupabaseDiagnostics();
    }, 2000);
  }
}
