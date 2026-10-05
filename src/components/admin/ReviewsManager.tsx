import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Stars } from "@/components/Stars";
import { useAdminReviews, type Review } from "@/lib/reviews";
import { useProducts } from "@/lib/store";
import { useAdmin } from "@/hooks/useAdmin";

/** Approve, hide or delete customer product reviews. */
export function ReviewsManager() {
  const qc = useQueryClient();
  const { data: list = [] } = useAdminReviews();
  const { data: products = [] } = useProducts();
  const { can, isViewer, isAddOnly } = useAdmin();
  const canEdit = can("manage_content") && !isViewer && !isAddOnly;
  const canDelete = can("delete_content") && !isViewer && !isAddOnly;

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
    await qc.invalidateQueries({ queryKey: ["review-stats"] });
    await qc.invalidateQueries({ queryKey: ["product-reviews"] });
  };

  const toggle = async (r: Review) => {
    const { error } = await supabase
      .from("product_reviews")
      .update({ is_approved: !r.is_approved })
      .eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
  };

  const remove = async (r: Review) => {
    const { error } = await supabase.from("product_reviews").delete().eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حذف التقييم");
    await refresh();
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <h2 className="text-lg font-extrabold">تقييمات المنتجات</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        التقييمات الجديدة تصل بحالة «بانتظار المراجعة» ولا تظهر للعملاء إلا بعد اعتمادك لها.
      </p>

      <div className="mt-4 space-y-3">
        {list.length === 0 && <p className="text-sm text-muted-foreground">لا توجد تقييمات.</p>}
        {list.map((r) => {
          const product = products.find((p) => p.id === r.product_id);
          return (
            <div
              key={r.id}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold">{r.customer_name}</span>
                  <Stars value={Number(r.rating)} size="xs" />
                  <span className="truncate text-[11px] text-muted-foreground">
                    {product?.name ?? "منتج محذوف"}
                  </span>
                  {!r.is_approved && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      بانتظار المراجعة
                    </span>
                  )}
                </div>
                {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
              </div>
              {(canEdit || canDelete) && (
                <div className="flex shrink-0 items-center gap-2">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => toggle(r)}
                      aria-label={r.is_approved ? "إخفاء" : "اعتماد"}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:border-primary"
                    >
                      {r.is_approved ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => remove(r)}
                      aria-label="حذف"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-destructive hover:border-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
