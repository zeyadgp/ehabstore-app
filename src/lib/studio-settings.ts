import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_STUDIO_SETTINGS,
  getStudioSettingsServer,
  saveStudioSettingsServer,
  studioSettingsSchema,
  type StudioSettings,
} from "@/lib/studio-settings.functions";

const LOCAL_STORAGE_KEY = "studio_page_settings";
const QUERY_KEY = ["studio-page-settings"];

function getStoredLocal(): StudioSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = studioSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function useStudioSettings() {
  const fetchServer = useServerFn(getStudioSettingsServer);

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<StudioSettings> => {
      try {
        // Try server function first
        const res = await fetchServer();
        if (res) {
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(res));
            } catch {
              /* ignore */
            }
          }
          return res;
        }
      } catch {
        // Fallback to direct supabase client read
        try {
          const { data } = await supabase
            .from("site_settings")
            .select("value")
            .eq("key", "studio_page_settings")
            .maybeSingle();

          if (data?.value) {
            const parsed = studioSettingsSchema.safeParse(JSON.parse(data.value));
            if (parsed.success) {
              if (typeof window !== "undefined") {
                try {
                  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed.data));
                } catch {
                  /* ignore */
                }
              }
              return parsed.data;
            }
          }
        } catch {
          /* ignore */
        }
      }

      return getStoredLocal() ?? DEFAULT_STUDIO_SETTINGS;
    },
    initialData: getStoredLocal() ?? DEFAULT_STUDIO_SETTINGS,
    staleTime: 30_000,
  });

  return query;
}

export function useSaveStudioSettings() {
  const qc = useQueryClient();
  const saveServer = useServerFn(saveStudioSettingsServer);

  return useMutation({
    mutationFn: async (settings: StudioSettings) => {
      // Optimistically update localStorage
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
        } catch {
          /* ignore */
        }
      }

      try {
        await saveServer({ data: settings });
      } catch (err) {
        // Direct supabase client fallback
        const json = JSON.stringify(settings);
        const { data: existing } = await supabase
          .from("site_settings")
          .select("id")
          .eq("key", "studio_page_settings")
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from("site_settings")
            .update({ value: json, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supabase.from("site_settings").insert({
            key: "studio_page_settings",
            value: json,
            group: "store_features",
            description: "إعدادات تعطيل وإخفاء صفحة وبطاقة تجربة المكياج",
          });
        }
      }

      return settings;
    },
    onSuccess: (saved) => {
      qc.setQueryData(QUERY_KEY, saved);
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
