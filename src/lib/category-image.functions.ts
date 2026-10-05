import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fromBase64, toBase64 } from "@/lib/ai-image.server";

const BUCKET = "store-images";

/**
 * Generates one professional (non-transparent) photo per category, with the store
 * logo placed small inside the image. Skips generation when the field already has
 * a value, so each category is generated only once.
 */
export const generateCategoryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; kind?: "icon" | "cover"; force?: boolean }) => {
    if (!input?.id) throw new Error("معرّف القسم مطلوب");
    return {
      id: input.id,
      kind: input?.kind === "cover" ? ("cover" as const) : ("icon" as const),
      force: Boolean(input?.force),
    };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("غير مصرح");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("مفتاح الذكاء الاصطناعي غير متوفر");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const field = data.kind === "cover" ? "cover_image" : "image";

    const { data: cat, error: catErr } = await supabaseAdmin
      .from("categories")
      .select("id,name,image,cover_image")
      .eq("id", data.id)
      .maybeSingle();
    if (catErr || !cat) throw new Error("القسم غير موجود");

    const existing = (cat as Record<string, string | null>)[field];
    if (existing && !data.force) return { path: existing, skipped: true };

    // Store logo (optional) — embedded small inside the generated image.
    let logoDataUrl: string | null = null;
    const { data: settings } = await supabaseAdmin
      .from("store_settings")
      .select("logo")
      .limit(1)
      .maybeSingle();
    const logo = settings?.logo ?? null;
    if (logo) {
      try {
        if (logo.startsWith("http")) {
          const r = await fetch(logo);
          if (r.ok) {
            const buf = new Uint8Array(await r.arrayBuffer());
            logoDataUrl = `data:${r.headers.get("content-type") ?? "image/png"};base64,${toBase64(buf)}`;
          }
        } else {
          const { data: file } = await supabaseAdmin.storage.from(BUCKET).download(logo);
          if (file) {
            const buf = new Uint8Array(await file.arrayBuffer());
            logoDataUrl = `data:${file.type || "image/png"};base64,${toBase64(buf)}`;
          }
        }
      } catch {
        logoDataUrl = null;
      }
    }

    const ratio = data.kind === "cover" ? "16:9 wide banner" : "1:1 square";
    const prompt =
      `Professional photographic image for a beauty store category named "${cat.name}". ` +
      `${ratio} composition, fully opaque background (no transparency). ` +
      "Premium studio still life of the relevant cosmetics/skincare/perfume/hair or beauty-device products, " +
      "soft warm gold (#C9A227) and blush rose (#E8B4B8) accents, light marble or silk surface, " +
      "cinematic soft lighting, high-end catalog quality, no people. " +
      (logoDataUrl
        ? "Place the provided brand logo small and tasteful in one corner as a subtle watermark, keeping it unchanged and legible. "
        : "") +
      "Do not render any other text, letters or watermarks.";

    const content: unknown[] = [{ type: "text", text: prompt }];
    if (logoDataUrl) content.push({ type: "image_url", image_url: { url: logoDataUrl } });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image",
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("تم تجاوز حد الاستخدام، حاول بعد قليل");
      if (res.status === 402) throw new Error("رصيد الذكاء الاصطناعي غير كافٍ");
      throw new Error(`فشل التوليد [${res.status}]: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as any;
    const out: string | undefined =
      json?.choices?.[0]?.message?.images?.[0]?.image_url?.url ??
      json?.data?.[0]?.b64_json ??
      json?.data?.[0]?.url;
    if (!out) throw new Error("لم يتم إنتاج صورة");

    const base64 = out.startsWith("data:") ? out.split(",")[1]! : out;
    const path = `categories/ai-${crypto.randomUUID()}.png`;
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, fromBase64(base64), { contentType: "image/png", upsert: false });
    if (upErr) throw new Error("تعذر حفظ الصورة المولّدة");

    const patch = field === "cover_image" ? { cover_image: path } : { image: path };
    await supabaseAdmin.from("categories").update(patch).eq("id", cat.id);
    return { path, skipped: false };
  });
