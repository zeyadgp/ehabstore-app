/** Server-only helpers for Lovable AI image generation. */
const BUCKET = "store-images";

export function toBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function fromBase64(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function adPrompt(topic: string, ratio: string) {
  return (
    `Create a luxury beauty-store advertising banner background, aspect ratio ${ratio}. ` +
    `Theme: ${topic}. Elegant cosmetics and skincare products arranged as a premium studio still life, ` +
    "soft warm gold and blush pink palette, clean marble or silk surface, cinematic soft lighting, " +
    "generous empty negative space on one side for text placement. " +
    "Photographic, high end catalog quality. Do not render any text, letters, logos or watermarks."
  );
}

/** Calls the Lovable AI gateway and stores the produced PNG, returning its storage path. */
export async function generateAndStore(
  apiKey: string,
  prompt: string,
  folder: string,
  supabaseAdmin: {
    storage: {
      from: (b: string) => {
        upload: (p: string, body: Uint8Array, o: object) => Promise<{ error: unknown }>;
      };
    };
  },
) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
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
  const path = `${folder}/ai-${crypto.randomUUID()}.png`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, fromBase64(base64), { contentType: "image/png", upsert: false });
  if (error) throw new Error("تعذر حفظ الصورة المولّدة");
  return { path };
}
