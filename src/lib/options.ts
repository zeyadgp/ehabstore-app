import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OptionKind = "color" | "size";

export type OptionValue = {
  id: string;
  option_id: string;
  product_id: string;
  name: string;
  code: string | null;
  swatch: string | null;
  images: string[];
  price: number | null;
  compare_at_price: number | null;
  stock: number;
  sku: string | null;
  is_available: boolean;
  sort_order: number;
  color_id?: string | null;
};

export type ProductOption = {
  id: string;
  product_id: string;
  kind: OptionKind;
  name: string;
  sort_order: number;
  values: OptionValue[];
};

/** خيارات منتج واحد (ألوان/مقاسات) — لا تُحمّل إلا في صفحة المنتج. */
export async function fetchProductOptions(productId: string): Promise<ProductOption[]> {
  const { data: options } = await supabase
    .from("product_options")
    .select("id, product_id, kind, name, sort_order")
    .eq("product_id", productId)
    .order("sort_order");
  if (!options || options.length === 0) return [];
  const { data: values } = await supabase
    .from("product_option_values")
    .select("*")
    .eq("product_id", productId)
    .order("sort_order");
  return (options as Omit<ProductOption, "values">[]).map((o) => ({
    ...o,
    values: ((values ?? []) as OptionValue[]).filter((v) => v.option_id === o.id),
  }));
}

export function productOptionsQuery(productId: string) {
  return {
    queryKey: ["product-options", productId],
    queryFn: () => fetchProductOptions(productId),
    staleTime: 60_000,
  };
}

export function useProductOptions(productId: string | undefined) {
  return useQuery({ ...productOptionsQuery(productId ?? ""), enabled: Boolean(productId) });
}

/** معرّفات المنتجات التي تملك خيارات — استعلام واحد خفيف تستخدمه البطاقات. */
export function useProductsWithOptions() {
  return useQuery({
    queryKey: ["products-with-options"],
    staleTime: 120_000,
    queryFn: async () => {
      const { data } = await supabase.from("product_options").select("product_id");
      return new Set(((data ?? []) as { product_id: string }[]).map((r) => r.product_id));
    },
  });
}

/** خريطة: معرّف المنتج ← معرّفات الألوان المعتمدة المرتبطة به (للفلترة حسب عائلة اللون). */
export function useProductColorLinks() {
  return useQuery({
    queryKey: ["product-color-links"],
    staleTime: 120_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_option_values")
        .select("product_id, color_id")
        .not("color_id", "is", null);
      const map = new Map<string, Set<string>>();
      ((data ?? []) as { product_id: string; color_id: string | null }[]).forEach((r) => {
        if (!r.color_id) return;
        const set = map.get(r.product_id) ?? new Set<string>();
        set.add(r.color_id);
        map.set(r.product_id, set);
      });
      return map;
    },
  });
}

export function colorsOf(options: ProductOption[]) {
  return options.find((o) => o.kind === "color")?.values.filter((v) => v.is_available) ?? [];
}

export function sizesOf(options: ProductOption[]) {
  return options.find((o) => o.kind === "size")?.values.filter((v) => v.is_available) ?? [];
}
