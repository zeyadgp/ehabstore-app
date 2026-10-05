import { supabase } from "@/integrations/supabase/client";
import { webpifyStoredImage } from "@/lib/image-optimize";

/**
 * تحويل جماعي لكل صور المتجر المخزّنة إلى صيغة WebP المضغوطة.
 * يتخطى الصور المحوّلة مسبقاً والروابط الخارجية، ويحدّث السجلات بالمسار الجديد.
 */
export type WebpProgress = { done: number; total: number; converted: number };

type Job = {
  table:
    | "products"
    | "categories"
    | "banners"
    | "brands"
    | "product_option_values"
    | "store_settings"
    | "themes"
    | "payment_methods";
  id: string;
  column: string;
  /** مسار مفرد، أو فهرس داخل مصفوفة الصور */
  index?: number;
  path: string;
  folder: string;
  all?: string[];
};

const needs = (p: unknown): p is string =>
  typeof p === "string" && p.length > 0 && !p.startsWith("http") && !p.endsWith(".webp");

async function collect(): Promise<Job[]> {
  const jobs: Job[] = [];
  const [products, categories, banners, brands, values, settings, themes, payments] =
    await Promise.all([
      supabase.from("products").select("id, images"),
      supabase.from("categories").select("id, image, cover_image"),
      supabase.from("banners").select("id, image"),
      supabase.from("brands").select("id, image"),
      supabase.from("product_option_values").select("id, images"),
      supabase.from("store_settings").select("id, logo, hero_image, og_image, store_image"),
      supabase.from("themes").select("id, preview_image, background_image"),
      supabase.from("payment_methods").select("id, image"),
    ]);

  const pushArray = (
    table: Job["table"],
    rows: { id: string; images: string[] | null }[] | null,
    folder: string,
  ) => {
    for (const row of rows ?? []) {
      const all = row.images ?? [];
      all.forEach((p, index) => {
        if (needs(p))
          jobs.push({ table, id: row.id, column: "images", index, path: p, folder, all });
      });
    }
  };

  const pushSingle = (
    table: Job["table"],
    rows: Record<string, unknown>[] | null,
    column: string,
    folder: string,
  ) => {
    for (const row of rows ?? []) {
      const p = row[column];
      if (needs(p)) jobs.push({ table, id: String(row["id"]), column, path: p, folder });
    }
  };

  pushArray("products", products.data as never, "products");
  pushArray("product_option_values", values.data as never, "products");
  pushSingle("categories", categories.data as never, "image", "categories");
  pushSingle("categories", categories.data as never, "cover_image", "categories");
  pushSingle("banners", banners.data as never, "image", "banners");
  pushSingle("brands", brands.data as never, "image", "brands");
  pushSingle("store_settings", settings.data as never, "logo", "branding");
  pushSingle("store_settings", settings.data as never, "hero_image", "settings");
  pushSingle("store_settings", settings.data as never, "og_image", "settings");
  pushSingle("store_settings", settings.data as never, "store_image", "settings");
  pushSingle("themes", themes.data as never, "preview_image", "themes");
  pushSingle("themes", themes.data as never, "background_image", "themes");
  pushSingle("payment_methods", payments.data as never, "image", "payments");
  return jobs;
}

export async function convertAllImagesToWebp(
  onProgress?: (p: WebpProgress) => void,
): Promise<WebpProgress> {
  const jobs = await collect();
  const state: WebpProgress = { done: 0, total: jobs.length, converted: 0 };
  onProgress?.({ ...state });

  // نجمع تحديثات مصفوفات الصور لكل سجل حتى لا نكتب فوق بعضها
  const arrays = new Map<string, { table: Job["table"]; id: string; list: string[] }>();

  for (const job of jobs) {
    try {
      const next = await webpifyStoredImage(job.path, job.folder);
      if (next !== job.path) {
        state.converted += 1;
        if (job.index != null) {
          const key = `${job.table}:${job.id}`;
          const entry = arrays.get(key) ?? {
            table: job.table,
            id: job.id,
            list: [...(job.all ?? [])],
          };
          entry.list[job.index] = next;
          arrays.set(key, entry);
        } else {
          await supabase
            .from(job.table)
            .update({ [job.column]: next } as never)
            .eq("id", job.id);
        }
      }
    } catch {
      /* نتجاهل الصورة المتعذّرة ونكمل */
    }
    state.done += 1;
    onProgress?.({ ...state });
  }

  for (const entry of arrays.values()) {
    await supabase
      .from(entry.table)
      .update({ images: entry.list } as never)
      .eq("id", entry.id);
  }
  return state;
}
