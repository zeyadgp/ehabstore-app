import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Gift, Share2, Users } from "lucide-react";
import { StoreLogo } from "@/components/StoreLogo";
import { toast } from "sonner";
import { getMyReferralInfo } from "@/lib/loyalty.functions";
import { useSessionUser } from "@/lib/account";
import { Link } from "@tanstack/react-router";

export function ReferralCard() {
  const { userId } = useSessionUser();
  const fetchReferral = useServerFn(getMyReferralInfo);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["my-referral-info", userId],
    enabled: !!userId,
    queryFn: () => fetchReferral({ data: {} }),
  });

  if (!userId) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl gradient-gold text-primary-foreground shadow-soft">
            <Gift className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-extrabold text-foreground">
              نظام الإحالة ودعوة الأصدقاء
            </h3>
            <p className="text-xs text-muted-foreground">
              سجّل دخولك لتحصل على رابط إحالة خاص بك واكسب نقاط ولاء ومكافآت مع كل صديق تدعينها.
            </p>
          </div>
        </div>
        <div className="mt-4 text-center sm:text-start">
          <Link
            to="/auth"
            search={{ next: "/loyalty" }}
            className="inline-flex items-center gap-2 rounded-xl gradient-gold px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-soft transition-transform hover:opacity-95 active:scale-95"
          >
            <StoreLogo className="h-4 w-4 text-primary-foreground" />
            <span>تسجيل الدخول لتفعيل رابط الإحالة</span>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="h-6 w-1/3 rounded-lg bg-secondary" />
        <div className="mt-2 h-4 w-2/3 rounded-lg bg-secondary" />
        <div className="mt-4 h-12 rounded-2xl bg-secondary" />
      </div>
    );
  }

  if (!data || !data.referralEnabled) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://ehabstore.app";
  const referralUrl = `${origin}/?ref=${data.referralCode}`;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopiedLink(true);
      toast.success("تم نسخ رابط الإحالة بنجاح");
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error("تعذّر نسخ الرابط");
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(data.referralCode);
      setCopiedCode(true);
      toast.success("تم نسخ كود الإحالة");
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      toast.error("تعذّر نسخ الكود");
    }
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `مرحباً! أنصحك بمتجر إيهاب ستور للعناية والتجميل والعطور الأصلية ✨\nتسوق عبر رابطي الخاص واحصل على نقاط ومكافآت ترحيبية:\n${referralUrl}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl gradient-gold text-primary-foreground shadow-soft">
            <Gift className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-extrabold text-foreground">
              رابط الإحالة ودعوة الأصدقاء
            </h3>
            <p className="text-xs text-muted-foreground">
              شارك رابطك مع أصدقائك واحصل على مكافآت فورية ونقاط ولاء
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-extrabold text-primary">
          <Users className="h-3.5 w-3.5" />
          <span>{data.referralsCount} صديق مسجلة</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-secondary/30 p-3 text-center">
          <span className="text-[11px] text-muted-foreground">نقاطك لكل صديق</span>
          <p className="mt-1 font-display text-lg font-extrabold text-primary">
            +{data.referrerPoints} نقطة
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/30 p-3 text-center">
          <span className="text-[11px] text-muted-foreground">نقاط ترحيبية لصديقك</span>
          <p className="mt-1 font-display text-lg font-extrabold text-foreground">
            +{data.inviteePoints} نقطة
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/30 p-3 text-center">
          <span className="text-[11px] text-muted-foreground">كود الإحالة الخاص بك</span>
          <div className="mt-1 flex items-center justify-center gap-1.5">
            <span dir="ltr" className="font-mono text-sm font-extrabold text-primary">
              {data.referralCode}
            </span>
            <button
              onClick={() => void copyCode()}
              className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="نسخ الكود"
              aria-label="نسخ الكود"
            >
              {copiedCode ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-bold text-foreground">
          رابط الإحالة الخاص بك:
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center rounded-2xl border border-border bg-background px-3 py-2.5">
            <span dir="ltr" className="truncate text-xs font-mono text-foreground select-all">
              {referralUrl}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void copyUrl()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-secondary active:scale-95 sm:flex-initial"
            >
              {copiedLink ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  <span>تم النسخ</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-primary" />
                  <span>نسخ الرابط</span>
                </>
              )}
            </button>
            <button
              onClick={shareWhatsApp}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#25D366] px-4 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90 active:scale-95 sm:flex-initial"
            >
              <Share2 className="h-4 w-4" />
              <span>مشاركة عبر واتساب</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border/70 bg-background/50 p-3 text-xs text-muted-foreground">
        <p className="font-bold text-foreground">كيف يعمل نظام الإحالة؟</p>
        <ol className="mt-1.5 list-decimal space-y-1 pe-4 text-[11px] leading-relaxed">
          <li>شارك الرابط أو كود الإحالة مع أصدقائك وأقاربك.</li>
          <li>عندما يفتح صديقك الرابط ويسجل في المتجر، سيكتسب تلقائياً نقاطاً ترحيبية.</li>
          <li>
            فور إتمام أول طلب ناجح لصديقك، ستُضاف نقاط المكافأة إلى رصيدك في نادي الولاء فوراً!
          </li>
        </ol>
      </div>
    </div>
  );
}
