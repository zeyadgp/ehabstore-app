import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, X } from "lucide-react";
import { toast } from "sonner";
import { SmartImage } from "@/components/SmartImage";
import { fallbackFor } from "@/lib/images";
import { fetchMyReview, upsertMyReview } from "@/lib/reviews";
import { useSessionUser } from "@/lib/account";

/** نافذة تقييم موحّدة تُستخدم من بطاقة المنتج ومن صفحة المنتج. */
export function ReviewDialog({
  open,
  onClose,
  productId,
  productName,
  images,
  categorySlug,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  images?: string[] | null;
  categorySlug?: string | undefined;
}) {
  const qc = useQueryClient();
  const { userId, loading } = useSessionUser();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let alive = true;
    void fetchMyReview(productId, userId).then((r) => {
      if (!alive || !r) return;
      setExisting(true);
      setRating(Number(r.rating) || 5);
      setComment(r.comment ?? "");
    });
    return () => {
      alive = false;
    };
  }, [open, userId, productId]);

  if (!open) return null;

  const send = async () => {
    if (!userId) return;
    setBusy(true);
    const { error } = await upsertMyReview({
      product_id: productId,
      user_id: userId,
      rating,
      comment,
    });
    setBusy(false);
    if (error) {
      toast.error("تعذر حفظ التقييم، حاول مرة أخرى");
      return;
    }
    toast.success(existing ? "تم تحديث تقييمك" : "شكراً لك! تم إرسال تقييمك");
    await qc.invalidateQueries({ queryKey: ["review-stats"] });
    await qc.invalidateQueries({ queryKey: ["product-reviews", productId] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-background/70 p-3 backdrop-blur sm:items-center">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <SmartImage
              paths={images ?? []}
              fallback={fallbackFor(categorySlug)}
              alt={productName}
              className="h-12 w-12 shrink-0 rounded-xl object-cover"
            />
            <p className="line-clamp-2 text-sm font-extrabold">{productName}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? null : !userId ? (
          <div className="mt-5 text-center">
            <p className="text-xs text-muted-foreground">سجّل الدخول لتتمكن من تقييم المنتج.</p>
            <Link
              to="/auth"
              className="mt-3 inline-block rounded-xl gradient-gold px-5 py-2.5 text-xs font-bold text-primary-foreground"
            >
              تسجيل الدخول
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-col items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">اختر التقييم بالقلوب:</span>
              <div className="flex items-center justify-center gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRating(i + 1)}
                    aria-label={`تقييم ${i + 1} من 5 قلوب`}
                    className="group p-1 transition-transform hover:scale-125 active:scale-95"
                  >
                    <Heart
                      className={`h-8 w-8 transition-all ${
                        i < rating
                          ? "fill-primary text-primary drop-shadow-xs"
                          : "text-muted-foreground/30 hover:text-primary/70"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="text-xs font-bold text-primary">
                {rating === 5
                  ? "ممتاز جداً (5 قلوب)"
                  : rating === 4
                    ? "رائع (4 قلوب)"
                    : rating === 3
                      ? "جيد (3 قلوب)"
                      : rating === 2
                        ? "مقبول (قلبان)"
                        : "قلب واحد"}
              </span>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="تعليقك (اختياري)"
              className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => void send()}
              disabled={busy}
              className="mt-3 w-full rounded-xl gradient-gold py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {existing ? "تحديث التقييم" : "إرسال التقييم"}
            </button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              تُنشر التقييمات بعد مراجعتها من إدارة المتجر.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
