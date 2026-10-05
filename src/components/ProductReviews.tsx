import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Stars } from "@/components/Stars";
import { submitReview, useProductReviews } from "@/lib/reviews";
import { ReviewDialog } from "@/components/ReviewDialog";

/** Public reviews list + submission form shown on the product page. */
export function ProductReviews({
  productId,
  productName = "",
  images,
}: {
  productId: string;
  productName?: string;
  images?: string[] | null;
}) {
  const qc = useQueryClient();
  const [rateOpen, setRateOpen] = useState(false);
  const { data: reviews = [], isLoading } = useProductReviews(productId);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);

  const avg = reviews.length
    ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length
    : 0;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await submitReview({
      product_id: productId,
      customer_name: name,
      rating,
      comment,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setComment("");
    setRating(5);
    toast.success("شكراً لك! سيظهر تقييمك بعد المراجعة");
    await qc.invalidateQueries({ queryKey: ["product-reviews", productId] });
    await qc.invalidateQueries({ queryKey: ["review-stats"] });
  };

  return (
    <section className="mt-16">
      <ReviewDialog
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        productId={productId}
        productName={productName}
        images={images ?? null}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 fill-primary text-primary" />
          <h2 className="text-xl font-extrabold">تقييمات وتجارب العملاء</h2>
        </div>
        <button
          type="button"
          onClick={() => setRateOpen(true)}
          className="flex items-center gap-1.5 rounded-xl gradient-gold px-4 py-2 text-xs font-bold text-primary-foreground shadow-soft transition-transform active:scale-95"
        >
          <Heart className="h-3.5 w-3.5 fill-current" />
          <span>قيّم المنتج</span>
        </button>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <Stars value={avg} size="md" />
            <span className="text-sm font-bold tabular-nums text-primary">
              {avg.toFixed(1)} من 5 قلوب
            </span>
            <span className="text-xs text-muted-foreground">({reviews.length} تقييم)</span>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          {isLoading && <div className="h-20 animate-pulse rounded-2xl bg-muted" />}
          {!isLoading && reviews.length === 0 && (
            <p className="text-sm text-muted-foreground">
              لا توجد تقييمات بعد، كن أول من يقيّم هذا المنتج ويمنحه قلوبه ♡
            </p>
          )}
          {reviews.map((r) => (
            <article
              key={r.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-soft"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">{r.customer_name}</span>
                <Stars value={Number(r.rating)} size="xs" />
              </div>
              {r.comment && (
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{r.comment}</p>
              )}
            </article>
          ))}
        </div>

        <form
          onSubmit={send}
          className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-soft"
        >
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 fill-primary text-primary" />
            <h3 className="text-sm font-extrabold">صندوق التقييم — أضف تقييمك</h3>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRating(i + 1)}
                aria-label={`تقييم ${i + 1} من 5 قلوب`}
                className="group p-1 transition-transform hover:scale-125 active:scale-95"
              >
                <Heart
                  className={`h-7 w-7 transition-all ${
                    i < rating
                      ? "fill-primary text-primary drop-shadow-xs"
                      : "text-muted-foreground/30 hover:text-primary/70"
                  }`}
                />
              </button>
            ))}
            <span className="ms-2 text-xs font-bold text-primary">{rating} من 5 قلوب</span>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسمك الكريم (اختياري)"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="اكتب تجربتك ورأيك في المنتج"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl gradient-gold py-3 text-sm font-bold text-primary-foreground shadow-soft transition-all duration-200 hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
          >
            إرسال التقييم
          </button>
          <p className="text-[11px] text-muted-foreground">
            تُنشر التقييمات بعد مراجعتها من إدارة المتجر.
          </p>
        </form>
      </div>
    </section>
  );
}
