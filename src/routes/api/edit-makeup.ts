import { createFileRoute } from "@tanstack/react-router";

import { editImage, imageSettings } from "@/lib/makeup-gateway.server";

export const Route = createFileRoute("/api/edit-makeup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("يرجى تسجيل الدخول لاستخدام الاستوديو.", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: u, error: uErr } = await supabaseAdmin.auth.getUser(token);
        if (uErr || !u.user)
          return new Response("يرجى تسجيل الدخول لاستخدام الاستوديو.", { status: 401 });
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey)
          return new Response("خدمة الفنان الافتراضي غير مهيأة حالياً.", { status: 500 });

        const form = await request.formData();
        const image = form.get("image");
        const prompt = form.get("prompt");
        if (!(image instanceof File) || typeof prompt !== "string" || !prompt.trim()) {
          return new Response("الصورة واختيار المكياج مطلوبان.", { status: 400 });
        }

        const upstream = await editImage({ ...imageSettings, apiKey }, form);
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
