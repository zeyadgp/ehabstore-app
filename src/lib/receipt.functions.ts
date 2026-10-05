import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  dataUrl: z.string().min(20).max(8_000_000),
  ext: z.string().trim().max(6).optional(),
});

/** Uploads a payment receipt image to private storage and returns its path. */
export const uploadReceipt = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<{ path: string }> => {
    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("صيغة الصورة غير مدعومة");
    const contentType = match[1] as string;
    const bytes = Buffer.from(match[2] as string, "base64");
    if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("حجم الصورة كبير جداً (الحد 5MB)");

    const ext = (data.ext || contentType.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
    const path = `receipts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from("store-images")
      .upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error(error.message);
    return { path };
  });
