/**
 * ضغط الصور تلقائياً وتحويلها دائماً إلى صيغة WebP.
 * يعمل في المتصفح، ويحافظ على الشفافية (Alpha) للشعارات وصور المنتجات.
 */
export type CompressOptions = {
  maxSize?: number;
  quality?: number;
};

const SKIP = ["image/svg+xml", "image/gif"];

function canCompress(file: File | Blob) {
  const type = file.type || "";
  return typeof window !== "undefined" && typeof document !== "undefined" && !SKIP.includes(type);
}

async function loadBitmap(
  file: Blob,
): Promise<{ width: number; height: number; draw: CanvasImageSource }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image load failed"));
      el.src = url;
    });
    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      draw: img,
    };
  } catch {
    if (typeof createImageBitmap === "function") {
      const bmp = await createImageBitmap(file);
      return { width: bmp.width, height: bmp.height, draw: bmp };
    }
    throw new Error("تعذّر قراءة بيانات الصورة");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** يحوّل الصورة والشعار إلى WebP بأبعاد وجودة عالية ويعيد ملفاً بصيغة image/webp */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  const { maxSize = 1600, quality = 0.85 } = options;
  if (!canCompress(file)) return file;
  try {
    const { width, height, draw } = await loadBitmap(file);
    if (!width || !height) return file;
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // مسح الكانفاس لضمان الشفافية في شعارات PNG
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(draw, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", quality),
    );
    if (!blob || blob.size === 0) return file;

    const baseName = (file.name || "image").replace(/\.[^.]+$/, "");
    const name = `${baseName}.webp`;
    return new File([blob], name, { type: "image/webp", lastModified: Date.now() });
  } catch (err) {
    console.warn("Failed to convert image to webp:", err);
    return file;
  }
}

/** ضغط ثم تحويل إلى Data URL (للرفع عبر دوال الخادم). */
export async function compressToDataUrl(file: File, options?: CompressOptions): Promise<string> {
  const compressed = await compressImage(file, options);
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذّر قراءة الصورة"));
    reader.readAsDataURL(compressed);
  });
}
