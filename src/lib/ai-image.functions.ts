import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "store-images";

const PRODUCT_PROMPT =
  "Enhance this e-commerce product photo: keep the exact same product, shape, label and colors. " +
  "Improve lighting, sharpness and clarity, clean up the background to a soft elegant studio backdrop, " +
  "remove noise and distractions, make it look like a professional luxury beauty-store catalog photo. " +
  "Do not add text or watermarks. Square framing, product centered.";

const LOGO_PROMPT =
  "Refine this brand logo: keep the exact same shapes, letters, symbol and colors. " +
  "Make edges crisp and vector-clean, balance the composition, center the mark inside a perfect square canvas " +
  "with comfortable padding, and place it on a clean solid white background. " +
  "Do not add or change any text, do not add effects, shadows or watermarks.";

export const enhanceProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string; mode?: "product" | "logo" }) => {
    if (!input?.path || typeof input.path !== "string") throw new Error("مسار الصورة مطلوب");
    return {
      path: input.path,
      mode: input.mode === "logo" ? ("logo" as const) : ("product" as const),
    };
  })
  .handler(async ({ data, context }) => {
    const prompt = data.mode === "logo" ? LOGO_PROMPT : PRODUCT_PROMPT;
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("غير مصرح");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("مفتاح الذكاء الاصطناعي غير متوفر");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let dataUrl: string;
    if (data.path.startsWith("http")) {
      const supaHost = new URL(process.env["SUPABASE_URL"] ?? "https://invalid.local").host;
      let target: URL;
      try {
        target = new URL(data.path);
      } catch {
        throw new Error("رابط الصورة غير صالح");
      }
      if (target.protocol !== "https:" || target.host !== supaHost) {
        throw new Error("يُسمح فقط بصور تخزين المتجر");
      }
      const res = await fetch(target.toString(), { redirect: "error" });
      if (!res.ok) throw new Error("تعذر قراءة الصورة");
      const buf = new Uint8Array(await res.arrayBuffer());
      const mime = res.headers.get("content-type") ?? "image/jpeg";
      dataUrl = `data:${mime};base64,${toBase64(buf)}`;
    } else {
      const { data: file, error } = await supabaseAdmin.storage.from(BUCKET).download(data.path);
      if (error || !file) throw new Error("تعذر قراءة الصورة من التخزين");
      const buf = new Uint8Array(await file.arrayBuffer());
      const mime = file.type || "image/jpeg";
      dataUrl = `data:${mime};base64,${toBase64(buf)}`;
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("تم تجاوز حد الاستخدام، حاول بعد قليل");
      if (res.status === 402) throw new Error("رصيد الذكاء الاصطناعي غير كافٍ");
      throw new Error(`فشل التحسين [${res.status}]: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as any;
    const out: string | undefined =
      json?.choices?.[0]?.message?.images?.[0]?.image_url?.url ??
      json?.data?.[0]?.b64_json ??
      json?.data?.[0]?.url;
    if (!out) throw new Error("لم يتم إنتاج صورة");

    const base64 = out.startsWith("data:") ? out.split(",")[1]! : out;
    const bytes = fromBase64(base64);
    const folder = data.mode === "logo" ? "branding" : "products";
    const newPath = `${folder}/enhanced-${crypto.randomUUID()}.png`;
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(newPath, bytes, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error("تعذر حفظ الصورة المحسّنة");

    return { path: newPath };
  });

function toBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function fromBase64(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
