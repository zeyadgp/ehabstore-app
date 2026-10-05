import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCategories, type Category, type Product } from "@/lib/store";
import { saveOfflineBrands, getOfflineBrands } from "@/lib/offline-catalog";

export type Brand = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  description: string | null;
  is_active?: boolean;
  sort_order?: number;
};

export type ProductBrand = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  description?: string | null;
};

export async function fetchBrands(): Promise<Brand[]> {
  try {
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, slug, image, description, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    const list = (data as Brand[] | null) ?? [];
    if (list.length > 0) saveOfflineBrands(list);
    return list;
  } catch (err) {
    console.warn("[Brands] fetchBrands failed, using offline cache:", err);
    const cached = getOfflineBrands();
    return cached.length > 0 ? cached : [];
  }
}

export const brandsQuery = {
  queryKey: ["brands"],
  queryFn: fetchBrands,
  staleTime: 60_000,
};

export function useBrands() {
  return useQuery(brandsQuery);
}

/** يجلب المعرفات للأقسام المرتبطة بالمنتج (بما فيها الماركات). */
export function useProductCategoryLinks(productId: string | undefined) {
  return useQuery({
    queryKey: ["product-category-links", productId],
    enabled: Boolean(productId),
    staleTime: 60_000,
    queryFn: async () => {
      if (!productId) return [];
      const { data } = await supabase
        .from("product_categories")
        .select("category_id")
        .eq("product_id", productId);
      return ((data ?? []) as { category_id: string }[]).map((r) => r.category_id);
    },
  });
}

/**
 * يحدد العلامة التجارية المرتبطة بالمنتج مع صورتها واسمها:
 * 1. من معرّف الماركة brand_id في جدول products (جدول brands أو categories من نوع brand)
 * 2. من جدول الربط product_categories للأقسام من نوع brand
 * 3. من قسم المنتج الأساسي إذا كان نوعه brand
 */
export function useProductBrand(
  product: Product | null | undefined,
  directCategory?: Category | null,
): ProductBrand | null {
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  const { data: linkedCatIds = [] } = useProductCategoryLinks(product?.id);

  if (!product) return null;

  const brandCategories = categories.filter((c) => c.kind === "brand");

  // 1. فحص brand_id من جدول products
  if (product.brand_id) {
    // هل يطابق سجلاً في جدول brands؟
    const brandRow = brands.find((b) => b.id === product.brand_id);
    if (brandRow) {
      const matchingCat = brandCategories.find((c) => c.slug === brandRow.slug);
      return {
        id: brandRow.id,
        name: brandRow.name,
        slug: brandRow.slug,
        image: brandRow.image || matchingCat?.image || matchingCat?.cover_image || null,
        description: brandRow.description || matchingCat?.description || null,
      };
    }

    // هل يطابق قسماً من نوع brand؟
    const catBrand = brandCategories.find((c) => c.id === product.brand_id);
    if (catBrand) {
      return {
        id: catBrand.id,
        name: catBrand.name,
        slug: catBrand.slug,
        image: catBrand.image || catBrand.cover_image || null,
        description: catBrand.description || null,
      };
    }
  }

  // 2. فحص جدول product_categories لأي قسم نوعه brand
  if (linkedCatIds.length > 0) {
    const linkedBrandCat = brandCategories.find((c) => linkedCatIds.includes(c.id));
    if (linkedBrandCat) {
      const matchingBrand = brands.find((b) => b.slug === linkedBrandCat.slug);
      return {
        id: linkedBrandCat.id,
        name: linkedBrandCat.name,
        slug: linkedBrandCat.slug,
        image: linkedBrandCat.image || linkedBrandCat.cover_image || matchingBrand?.image || null,
        description: linkedBrandCat.description || matchingBrand?.description || null,
      };
    }
  }

  // 3. فحص القسم المباشر للمنتج إذا كان من نوع brand
  const cat = directCategory ?? categories.find((c) => c.id === product.category_id);
  if (cat && cat.kind === "brand") {
    const matchingBrand = brands.find((b) => b.slug === cat.slug);
    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      image: cat.image || cat.cover_image || matchingBrand?.image || null,
      description: cat.description || matchingBrand?.description || null,
    };
  }

  return null;
}
