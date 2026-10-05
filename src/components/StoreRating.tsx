import { useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** صندوق تقييم المتجر — يظهر في الصفحة الرئيسية تحت آراء العملاء. */
export function StoreRating() {
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error("اكتب رأيك أولاً");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("testimonials").insert({
      customer_name: name.trim() || "عميل المتجر",
      content: content.trim(),
      rating: Math.min(5, Math.max(1, rating)),
      is_visible: false,
    });
    setBusy(false);
    if (error) {
      toast.error("تعذر إرسال التقييم، حاول لاحقاً");
      return;
    }
    setDone(true);
    toast.success("شكراً لك! سيظهر رأيك بعد المراجعة");
  };

  return (
    <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-primary/20 bg-card p-6 text-right shadow-soft">
      <div className="flex items-center justify-center gap-2">
        <Heart className="h-5 w-5 fill-primary text-primary" />
        <h3 className="text-center text-lg font-black text-foreground">صندوق التقييمات</h3>
        <Heart className="h-5 w-5 fill-primary text-primary" />
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        شاركنا تقييمك لتجربة المتجر بالقلوب ورأيك الصادق
      </p>

      {done ? (
        <p className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-center text-sm font-bold text-primary shadow-soft">
          تم استلام تقييمك بنجاح، شكراً لثقتك ودعمك ♡
        </p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="flex flex-col items-center gap-2">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} قلوب`}
                  onClick={() => setRating(n)}
                  className="group p-1.5 transition-transform hover:scale-125 active:scale-95"
                >
                  <Heart
                    className={`h-8 w-8 transition-all ${
                      n <= rating
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
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسمك الكريم (اختياري)"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="كيف كانت تجربتك مع منتجات وخدمات المتجر؟"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl gradient-gold py-3 text-sm font-extrabold text-primary-foreground shadow-soft transition-all duration-200 hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "جاري الإرسال…" : "إرسال التقييم"}
          </button>
        </form>
      )}
    </div>
  );
}
