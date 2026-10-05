import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BannerPlacement = "hero" | "strip" | "content" | "ticker";

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  image: string | null;
  cta_label: string | null;
  cta_url: string | null;
  placement: string;
  category_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

/** Recommended image sizes per placement, shown as hints in the dashboard. */
export const bannerSizes: Record<BannerPlacement, { label: string; size: string; ratio: string }> =
  {
    hero: { label: "بانر رئيسي", size: "1600 × 900 بكسل", ratio: "16:9" },
    strip: { label: "شريط إعلاني عريض", size: "1600 × 500 بكسل", ratio: "3.2:1" },
    content: { label: "إعلان داخل المحتوى", size: "1200 × 1200 بكسل", ratio: "1:1" },
    ticker: { label: "عبارة متحركة (شريط الثقة)", size: "بدون صورة", ratio: "1:1" },
  };

export const placementLabels: Record<string, string> = {
  hero: "بانر رئيسي (أعلى الصفحة)",
  strip: "شريط إعلاني عريض",
  content: "إعلان داخل المحتوى",
  ticker: "عبارة متحركة (شريط الثقة)",
};

export async function fetchBanners(): Promise<Banner[]> {
  const { data } = await supabase
    .from("banners")
    .select(
      "id, title, subtitle, badge, image, cta_label, cta_url, placement, category_id, sort_order, is_active, created_at",
    )
    .eq("is_active", true)
    .order("sort_order");
  return (data as Banner[] | null) ?? [];
}

export const bannersQuery = { queryKey: ["banners"], queryFn: fetchBanners, staleTime: 60_000 };

export function useBanners(placement?: BannerPlacement) {
  const q = useQuery(bannersQuery);
  const data = (q.data ?? []).filter((b) => !placement || b.placement === placement);
  return { ...q, data };
}

export function useAdminBanners() {
  return useQuery({
    queryKey: ["admin", "banners"],
    queryFn: async (): Promise<Banner[]> => {
      const { data, error } = await supabase
        .from("banners")
        .select(
          "id, title, subtitle, badge, image, cta_label, cta_url, placement, category_id, sort_order, is_active, created_at",
        )
        .order("sort_order");
      if (error) throw error;
      return (data as unknown as Banner[]) ?? [];
    },
  });
}
