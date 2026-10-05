import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  paths: z.array(z.string().trim().min(1).max(500)).max(100),
});

const PUBLIC_FOLDERS = new Set([
  "products",
  "categories",
  "banners",
  "branding",
  "payments",
  "settings",
  "themes",
]);

function addValue(allowed: Set<string>, value: unknown) {
  if (typeof value === "string" && value && !value.startsWith("http")) allowed.add(value);
  if (Array.isArray(value)) value.forEach((item) => addValue(allowed, item));
}

/** يمنح روابط مؤقتة لصور واجهة المتجر فقط، ولا يتيح الإيصالات أو صور الحسابات. */
export const signPublicStoreImages = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<Record<string, string>> => {
    const requested = [...new Set(data.paths)].filter((path) => {
      const folder = path.split("/", 1)[0];
      return folder ? PUBLIC_FOLDERS.has(folder) : false;
    });
    if (requested.length === 0) return {};

    if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      console.error("[public-images] إعدادات قاعدة البيانات غير متوفرة؛ تُعرض الصور الافتراضية");
      return {};
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [products, categories, brands, banners, payments, settings, themes] = await Promise.all([
      supabaseAdmin.from("products").select("images").eq("status", true),
      supabaseAdmin.from("categories").select("image,cover_image").eq("is_active", true),
      supabaseAdmin.from("brands").select("image").eq("is_active", true),
      supabaseAdmin.from("banners").select("image").eq("is_active", true),
      supabaseAdmin.from("payment_methods").select("icon").eq("is_active", true),
      supabaseAdmin
        .from("store_settings")
        .select("logo,og_image,hero_image,store_image,ios_badge_image,android_badge_image")
        .limit(1),
      supabaseAdmin.from("themes").select("thumbnail"),
    ]);

    const allowed = new Set<string>();
    for (const result of [products, categories, brands, banners, payments, settings, themes]) {
      for (const row of result.data ?? []) {
        Object.values(row as Record<string, unknown>).forEach((value) => addValue(allowed, value));
      }
    }

    const safePaths = requested.filter((path) => allowed.has(path));
    if (safePaths.length === 0) return {};
    const { data: signed, error } = await supabaseAdmin.storage
      .from("store-images")
      .createSignedUrls(safePaths, 60 * 60 * 24 * 7);
    if (error) throw new Error("تعذّر تحميل صور المتجر");

    return Object.fromEntries(
      (signed ?? [])
        .filter((item) => item.path && item.signedUrl)
        .map((item) => [item.path as string, item.signedUrl as string]),
    );
  });
