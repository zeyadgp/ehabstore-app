import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BUCKET = "store-images";

/** يسرد كل صور المتجر (للمدير فقط) لأن صلاحيات المتصفح لا ترى كل المجلدات. */
export const listAllStoreFiles = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdminCaller } = await import("./caller.server");
  await requireAdminCaller();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const walk = async (prefix: string): Promise<string[]> => {
    const out: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .list(prefix, { limit: 1000, offset });
      if (error || !data || data.length === 0) break;
      for (const item of data) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id) out.push(path);
        else out.push(...(await walk(path)));
      }
      if (data.length < 1000) break;
    }
    return out;
  };
  return walk("");
});

/** روابط تنزيل مؤقتة لمجموعة صور (للمدير فقط). */
export const signStoreFiles = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ paths: z.array(z.string().min(1)).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdminCaller } = await import("./caller.server");
    await requireAdminCaller();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrls(data.paths, 3600);
    const map: Record<string, string> = {};
    for (const s of signed ?? []) if (s.path && s.signedUrl) map[s.path] = s.signedUrl;
    return map;
  });
