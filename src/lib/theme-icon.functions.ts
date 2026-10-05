import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateAndStore } from "@/lib/ai-image.server";

/** Generates one small app-style icon per theme (called once, then stored on the theme row). */
export const generateThemeIcon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { name: string; primary: string; accent: string; background: string }) => ({
      name: (input?.name ?? "theme").slice(0, 60),
      primary: input?.primary ?? "#C9A227",
      accent: input?.accent ?? "#E8B4B8",
      background: input?.background ?? "#FFFFFF",
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("غير مصرح");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("مفتاح الذكاء الاصطناعي غير متوفر");

    const prompt =
      `Minimal luxury beauty app icon representing a UI theme named "${data.name}". ` +
      `Use exactly this palette: primary ${data.primary}, accent ${data.accent}, background ${data.background}. ` +
      "Flat vector, rounded square badge, simple elegant cosmetic/perfume symbol, centered, generous padding, " +
      "no text, no letters, no watermark. Square 1:1.";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return generateAndStore(apiKey, prompt, "themes", supabaseAdmin as never);
  });
