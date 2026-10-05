import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Review = {
  id: string;
  product_id: string;
  customer_name: string;
  rating: number;
  comment: string | null;
  is_approved: boolean;
  created_at: string;
};

export type ReviewStat = { avg: number; count: number };

/** Aggregated in Postgres (one small row per product) instead of pulling every review row. */
export async function fetchReviewStats(): Promise<Record<string, ReviewStat>> {
  const { data, error } = await supabase.rpc("product_rating_stats");
  const out: Record<string, ReviewStat> = {};
  if (error || !data) return out;
  (data as { product_id: string; avg_rating: number; review_count: number }[]).forEach((r) => {
    out[r.product_id] = { avg: Number(r.avg_rating) || 0, count: Number(r.review_count) || 0 };
  });
  return out;
}

export function useReviewStats() {
  return useQuery({
    queryKey: ["review-stats"],
    queryFn: fetchReviewStats,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });
}

export async function fetchProductReviews(productId: string): Promise<Review[]> {
  const { data } = await supabase
    .from("product_reviews")
    .select("*")
    .eq("product_id", productId)
    .eq("is_approved", true)
    .order("created_at", { ascending: false });
  return (data as Review[] | null) ?? [];
}

export function useProductReviews(productId: string | undefined) {
  return useQuery({
    queryKey: ["product-reviews", productId],
    enabled: Boolean(productId),
    queryFn: () => fetchProductReviews(productId as string),
  });
}

export async function submitReview(input: {
  product_id: string;
  customer_name: string;
  rating: number;
  comment: string;
}) {
  return supabase.from("product_reviews").insert({
    product_id: input.product_id,
    customer_name: input.customer_name.trim() || "زائر",
    rating: Math.min(5, Math.max(1, input.rating)),
    comment: input.comment.trim() || null,
    is_approved: false,
  });
}

/** تقييم المستخدم الحالي لهذا المنتج إن وُجد (للتعديل بدل التكرار). */
export async function fetchMyReview(productId: string, userId: string) {
  const { data } = await supabase
    .from("product_reviews")
    .select("*")
    .eq("product_id", productId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Review | null) ?? null;
}

/** إرسال/تحديث تقييم المستخدم المسجّل — فريد لكل (منتج، مستخدم). */
export async function upsertMyReview(input: {
  product_id: string;
  user_id: string;
  rating: number;
  comment: string;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const name =
    (userRes.user?.user_metadata?.["full_name"] as string | undefined)?.trim() ||
    userRes.user?.email?.split("@")[0] ||
    "عميل";
  return supabase.from("product_reviews").upsert(
    {
      product_id: input.product_id,
      user_id: input.user_id,
      customer_name: name,
      rating: Math.min(5, Math.max(1, input.rating)),
      comment: input.comment.trim() || null,
      is_approved: false,
    } as never,
    { onConflict: "product_id,user_id" },
  );
}

export function useAdminReviews() {
  return useQuery({
    queryKey: ["admin", "reviews"],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_reviews")
        .select("*")
        .order("created_at", { ascending: false });
      return (data as Review[] | null) ?? [];
    },
  });
}
