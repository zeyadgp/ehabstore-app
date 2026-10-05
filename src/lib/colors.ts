import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProductColor = {
  id: string;
  name: string;
  display_name: string;
  family: string;
  hex_code: string;
  swatch_image_url: string | null;
  sort_order: number;
};

export const DEFAULT_FAMILIES = ["أحمر", "وردي", "نيود", "بني", "بنفسجي", "جريء"];

const sb = () => supabase as never as { from: (t: string) => any };

export async function fetchProductColors(): Promise<ProductColor[]> {
  const { data } = await sb()
    .from("product_colors")
    .select("id,name,display_name,family,hex_code,swatch_image_url,sort_order")
    .order("sort_order")
    .order("display_name");
  return (data ?? []) as ProductColor[];
}

export function useProductColors() {
  return useQuery({
    queryKey: ["product-colors"],
    queryFn: fetchProductColors,
    staleTime: 300_000,
  });
}

/** عدد الدرجات المرتبطة بكل لون — يمنع حذف لون مستخدم. */
export function useColorUsage() {
  return useQuery({
    queryKey: ["product-colors", "usage"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await sb()
        .from("product_option_values")
        .select("color_id")
        .not("color_id", "is", null);
      const map: Record<string, number> = {};
      ((data ?? []) as { color_id: string }[]).forEach((r) => {
        map[r.color_id] = (map[r.color_id] ?? 0) + 1;
      });
      return map;
    },
  });
}

export async function saveProductColor(row: Partial<ProductColor> & { id?: string }) {
  const payload = {
    name: (row.name ?? "").trim(),
    display_name: (row.display_name ?? "").trim() || (row.name ?? "").trim(),
    family: row.family ?? DEFAULT_FAMILIES[0],
    hex_code: row.hex_code ?? "#000000",
    swatch_image_url: row.swatch_image_url ?? null,
    sort_order: Number(row.sort_order ?? 0),
  };
  if (row.id) {
    const { error } = await sb().from("product_colors").update(payload).eq("id", row.id);
    if (error) throw error;
    return row.id;
  }
  const { data, error } = await sb().from("product_colors").insert(payload).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteProductColor(id: string) {
  const { error } = await sb().from("product_colors").delete().eq("id", id);
  if (error) throw new Error("لا يمكن حذف لون مستخدم في منتج");
}

export type SwatchStyle = {
  enabled: boolean;
  shape: "circle" | "square";
  size: "sm" | "md" | "lg";
};

export function swatchClasses(style: SwatchStyle) {
  const size = style.size === "sm" ? "h-8 w-8" : style.size === "lg" ? "h-14 w-14" : "h-11 w-11";
  const shape = style.shape === "square" ? "rounded-xl" : "rounded-full";
  return `${size} ${shape}`;
}
