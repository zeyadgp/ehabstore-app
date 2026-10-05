import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProductCopyResult = { text: string };

const SYSTEM = [
  "أنت كاتب محتوى تسويقي محترف لمتجر عناية وتجميل يمني، وتكتب بالعربية الفصحى المبسطة.",
  "أعد دائماً النتيجة بهذا الترتيب وبصيغة Markdown:",
  "## اسم مقترح للمنتج",
  "## وصف تسويقي منسّق (فقرة قصيرة جذابة)",
  "## أبرز المميزات (نقاط قصيرة)",
  "## طريقة الاستخدام (إن أمكن)",
  "## كلمات مفتاحية للبحث (سطر واحد مفصول بفواصل)",
  "## اقتراحات لتحسين بيانات المنتج (نقاط عملية: الصورة، السعر، التصنيف، المعلومات الناقصة)",
  "لا تخترع مكوّنات أو ادعاءات طبية. اجعل النص جاهزاً للنسخ مباشرة.",
].join("\n");

export const generateProductCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { info?: string; imageDataUrl?: string }) => {
    const info = (input?.info ?? "").trim().slice(0, 2000);
    const imageDataUrl =
      typeof input?.imageDataUrl === "string" && input.imageDataUrl.startsWith("data:image/")
        ? input.imageDataUrl
        : undefined;
    if (!info && !imageDataUrl) throw new Error("اكتب معلومات المنتج أو ارفع صورته");
    return { info, imageDataUrl };
  })
  .handler(async ({ data, context }): Promise<ProductCopyResult> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("غير مصرح");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("مفتاح الذكاء الاصطناعي غير متوفر");

    const content: Record<string, unknown>[] = [
      {
        type: "input_text",
        text: data.info
          ? `معلومات المنتج من مدير المتجر:\n${data.info}`
          : "لا توجد معلومات مكتوبة، استنتج تفاصيل المنتج من الصورة المرفقة.",
      },
    ];
    if (data.imageDataUrl) {
      content.push({ type: "input_image", image_url: data.imageDataUrl });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions: SYSTEM,
        input: [{ role: "user", content }],
        stream: true,
        store: false,
        reasoning: { effort: "low" },
      }),
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("تم تجاوز حد الاستخدام، حاولي بعد قليل");
      if (res.status === 402) throw new Error("رصيد الذكاء الاصطناعي غير كافٍ");
      throw new Error(`تعذّر توليد النص [${res.status}]: ${body.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload) as {
              type?: string;
              delta?: string;
              response?: { output_text?: string };
            };
            if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
              text += evt.delta;
            } else if (evt.type === "response.completed" && !text && evt.response?.output_text) {
              text = evt.response.output_text;
            }
          } catch {
            /* تجاهل الأجزاء غير المكتملة */
          }
        }
      }
    }

    if (!text.trim()) throw new Error("لم يتم إنتاج نص، حاولي بمعلومات أوضح");
    return { text: text.trim() };
  });
