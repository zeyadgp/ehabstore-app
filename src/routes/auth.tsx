import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogIn, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useSettings } from "@/lib/store";
import { signInWithPhone } from "@/lib/account.functions";
import { processSignupReferral } from "@/lib/loyalty.functions";
import { WELCOME_KEY } from "@/lib/account";
import { StoreLogo } from "@/components/StoreLogo";

const title = "تسجيل الدخول | إيهاب ستور للعناية والتجميل";
const description =
  "سجّل الدخول إلى حسابك في إيهاب ستور بالبريد أو رقم الجوال لمتابعة طلباتك ونقاط الولاء.";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const raw = s["next"];
    return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")
      ? { next: raw }
      : {};
  },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const inputCls =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const { isAdmin, email: currentEmail } = useAdmin();
  const { data: settings } = useSettings();
  const requireConfirm = Boolean(
    (settings as unknown as { require_email_confirm?: boolean } | null)?.require_email_confirm,
  );
  const phoneLogin = useServerFn(signInWithPhone);
  const claimReferral = useServerFn(processSignupReferral);

  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ehab_referred_by") ?? "";
    }
    return "";
  });
  const [busy, setBusy] = useState(false);

  const afterLogin = () => {
    try {
      sessionStorage.removeItem(WELCOME_KEY);
    } catch {
      /* ignore */
    }
    if (next) {
      window.location.href = next;
      return;
    }
    void navigate({ to: "/" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(identifier.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك");
      } else if (mode === "login") {
        if (method === "phone") {
          const res = await phoneLogin({ data: { phone: identifier.trim(), password } });
          const { error } = await supabase.auth.setSession({
            access_token: res.access_token,
            refresh_token: res.refresh_token,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email: identifier.trim(),
            password,
          });
          if (error) throw error;
        }
        toast.success("تم تسجيل الدخول");
        afterLogin();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: identifier.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${next || "/account"}`,
            data: { full_name: fullName.trim(), phone: phone.trim() },
          },
        });
        if (error) throw error;
        if (data.session && data.user) {
          const finalRef = referralCode.trim() || null;
          await supabase.from("profiles").upsert({
            id: data.user.id,
            full_name: fullName.trim(),
            phone: phone.trim(),
            ...(finalRef ? { referred_by: finalRef } : {}),
          } as never);

          if (finalRef) {
            try {
              await claimReferral({ data: { referralCode: finalRef } });
              try {
                localStorage.removeItem("ehab_referred_by");
              } catch {
                /* ignore */
              }
            } catch (refErr) {
              console.warn("Referral processing error:", refErr);
            }
          }
        }
        if (!data.session && requireConfirm) {
          toast.success("تم إنشاء حسابك — افتح بريدك لتأكيد الحساب");
        } else {
          toast.success("تم إنشاء حسابك بنجاح");
          afterLogin();
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  const claimAdmin = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("claim_first_admin");
      if (error) throw error;
      if (data) {
        toast.success("تم منحك صلاحية المدير");
        void navigate({ to: "/admin" });
      } else {
        toast.error("يوجد مدير للمتجر بالفعل");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر تنفيذ العملية");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-14">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gradient-gold text-primary-foreground shadow-soft">
        <StoreLogo className="h-9 w-9" />
      </div>
      <h1 className="mt-4 text-center text-2xl font-extrabold">
        {mode === "signup" ? "إنشاء حساب جديد" : "تسجيل الدخول"}
      </h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {mode === "reset"
          ? "أدخل بريدك لإرسال رابط إعادة تعيين كلمة المرور"
          : "تابع طلباتك ونقاط الولاء وعناوينك المحفوظة"}
      </p>

      <form
        onSubmit={submit}
        className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-6 shadow-soft"
      >
        {mode === "login" && (
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary/50 p-1">
            {(["email", "phone"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMethod(m);
                  setIdentifier("");
                }}
                className={`rounded-lg py-2 text-xs font-bold transition-colors ${
                  method === m ? "gradient-gold text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {m === "email" ? "بالبريد الإلكتروني" : "برقم الجوال"}
              </button>
            ))}
          </div>
        )}

        {mode === "signup" && (
          <>
            <label className="block text-xs font-bold">
              الاسم الكامل
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block text-xs font-bold">
              رقم الجوال (واتساب)
              <input
                dir="ltr"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="7XXXXXXXX"
                className={inputCls}
              />
            </label>
          </>
        )}

        <label className="block text-xs font-bold">
          {mode === "login" && method === "phone" ? "رقم الجوال" : "البريد الإلكتروني"}
          <input
            dir="ltr"
            type={mode === "login" && method === "phone" ? "tel" : "email"}
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={inputCls}
          />
        </label>

        {mode !== "reset" && (
          <label className="block text-xs font-bold">
            كلمة المرور
            <input
              dir="ltr"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </label>
        )}

        {mode === "signup" && (
          <label className="block text-xs font-bold">
            كود الإحالة / دعوة صديق (اختياري)
            <input
              dir="ltr"
              type="text"
              placeholder="مثال: EH-XXXX"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              className={inputCls}
            />
            <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
              إذا وصلك رابط دعوة من صديق، ستحصل على نقاط ترحيبية فور إنشاء حسابك.
            </span>
          </label>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl gradient-gold py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          <LogIn className="h-4 w-4" />
          {mode === "login" ? "دخول" : mode === "signup" ? "إنشاء حساب" : "إرسال رابط الاستعادة"}
        </button>

        <div className="flex flex-wrap justify-center gap-4 text-xs font-bold text-primary">
          <button type="button" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>
            {mode === "signup" ? "لديك حساب؟ تسجيل الدخول" : "ليس لديك حساب؟ إنشاء حساب"}
          </button>
          {mode !== "reset" && (
            <button type="button" onClick={() => setMode("reset")}>
              نسيت كلمة المرور؟
            </button>
          )}
        </div>
      </form>

      {currentEmail && !isAdmin && (
        <div className="mt-6 rounded-2xl border border-dashed border-primary/50 bg-secondary/40 p-5 text-center">
          <ShieldCheck className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-2 text-xs text-muted-foreground">
            أنتِ مسجلة الدخول باسم{" "}
            <span dir="ltr" className="font-bold">
              {currentEmail}
            </span>{" "}
            بدون صلاحية مدير. إذا كان هذا أول إعداد للمتجر يمكنك تفعيل حساب المدير الأول.
          </p>
          <button
            onClick={claimAdmin}
            disabled={busy}
            className="mt-3 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
          >
            تفعيل حساب المدير الأول
          </button>
        </div>
      )}
    </div>
  );
}
