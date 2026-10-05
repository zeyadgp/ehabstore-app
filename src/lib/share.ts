/** أقصر مرجع ممكن للمنتج: رمز المنتج (مثل PR-1042) وإلا أول 7 أحرف من المعرّف. */
export function shortRef(product: { id: string; sku?: string | null }) {
  const sku = (product.sku ?? "").trim();
  if (sku) return sku;
  return product.id.replace(/-/g, "").slice(0, 7);
}

const PUBLIC_ORIGIN = "https://ehabstore.app";

/** رابط تشاركي ثابت يفتح من المتصفح وتطبيق واتساب دائماً. */
export function productUrl(slug: string) {
  if (typeof window === "undefined") return `${PUBLIC_ORIGIN}/product/${slug}`;
  const host = window.location.hostname;
  const isDev = host === "localhost" || host.includes("lovable");
  return `${isDev ? window.location.origin : PUBLIC_ORIGIN}/product/${slug}`;
}

/** Native share when available, clipboard copy otherwise. Returns the action taken. */
export async function shareProduct(
  name: string,
  slug: string,
): Promise<"shared" | "copied" | "failed"> {
  const url = productUrl(slug);
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: name, text: name, url });
      return "shared";
    }
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return "shared";
    try {
      await navigator.clipboard.writeText(url);
      return "copied";
    } catch {
      return "failed";
    }
  }
}
