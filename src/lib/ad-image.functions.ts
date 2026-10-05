import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adPrompt, generateAndStore } from "@/lib/ai-image.server";

export const generateAdImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { topic: string; ratio?: string }) => {
    const topic = (input?.topic ?? "").trim();
    if (!topic) throw new Error("اكتبي وصف الإعلان أولاً");
    return {
      topic: topic.slice(0, 300),
      ratio: input.ratio === "1:1" ? "1:1" : input.ratio === "3.2:1" ? "3.2:1" : "16:9",
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
    return generateAndStore(
      apiKey,
      adPrompt(data.topic, data.ratio),
      "banners",
      supabaseAdmin as never,
    );
  });
