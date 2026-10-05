import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";
import { removeImage, uploadImage } from "@/lib/admin";

const BUCKET = "store-images";

/**
 * يحوّل صورة مخزّنة (مثل مخرجات الذكاء الاصطناعي بصيغة PNG) إلى WebP مضغوط
 * لتقليل الحجم وتسريع المتجر. يعيد المسار الأصلي عند تعذّر التحويل.
 */
export async function webpifyStoredImage(path: string, folder?: string): Promise<string> {
  if (!path || path.startsWith("http") || path.endsWith(".webp")) return path;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) return path;
    const parts = path.split("/");
    const detectedFolder = folder || (parts.length > 1 ? parts[0] : "products");
    const name = parts.pop() ?? "image.png";
    let mime = data.type;
    if (!mime || mime === "application/octet-stream") {
      const ext = name.split(".").pop()?.toLowerCase();
      if (ext === "png") mime = "image/png";
      else if (ext === "jpg" || ext === "jpeg") mime = "image/jpeg";
      else if (ext === "webp") mime = "image/webp";
      else mime = "image/png";
    }
    const file = new File([data], name, { type: mime });
    const optimized = await compressImage(file, { maxSize: 1600, quality: 0.85 });
    if (optimized.type !== "image/webp" && !optimized.name.endsWith(".webp")) return path;
    const newPath = await uploadImage(optimized, detectedFolder);
    await removeImage(path);
    return newPath;
  } catch {
    return path;
  }
}
