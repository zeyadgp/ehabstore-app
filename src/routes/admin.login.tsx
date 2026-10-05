import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { StoreLogo } from "@/components/StoreLogo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [{ title: "دخول الإدارة | لوحة التحكم" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await (
        supabase as never as { rpc: (n: string) => Promise<{ data: unknown }> }
      ).rpc("admin_exists");
      if (!active) return;
      setNeedsSetup(data === false);
      setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      toast.error("بيانات الدخول غير صحيحة");
      return;
    }
    window.location.assign("/admin");
  };

  const createFirstAdmin = async () => {
    if (password.length < 8) {
      toast.error("كلمة المرور يجب أن تكون ٨ أحرف على الأقل");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: window.location.origin + "/admin/login",
      },
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      // بعض الإعدادات لا تُرجع جلسة مباشرة — نحاول الدخول بالبيانات نفسها
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setBusy(false);
        toast.success("تم إنشاء الحساب — افتح بريدك وأكّد الحساب ثم سجّل الدخول");
        setNeedsSetup(false);
        return;
      }
    }
    const sb = supabase as never as {
      rpc: (n: string) => Promise<{ data: unknown; error: unknown }>;
    };
    await sb.rpc("claim_first_admin");
    setBusy(false);
    toast.success("تم إنشاء حساب المدير الأعلى");
    // إعادة تحميل كاملة حتى تُقرأ الصلاحيات الجديدة قبل فتح اللوحة
    window.location.assign("/admin");
  };

  if (checking) {
    return <div className="py-24 text-center text-sm text-muted-foreground">جاري التحقق…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          {needsSetup ? (
            <StoreLogo className="h-5 w-5 text-primary" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-primary" />
          )}
          <h1 className="text-xl font-extrabold">
            {needsSetup ? "إعداد المدير الأول" : "دخول لوحة التحكم"}
          </h1>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          {needsSetup
            ? "لا يوجد مدير للنظام بعد. أنشئ حساب المدير الأعلى الآن."
            : "هذه الصفحة مخصصة للمديرين فقط."}
        </p>

        <div className="space-y-3">
          {needsSetup && (
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="الاسم الكامل"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          )}
          <input
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="البريد الإلكتروني"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            dir="ltr"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة المرور"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => void (needsSetup ? createFirstAdmin() : signIn())}
            disabled={busy || !email || !password || (needsSetup && !fullName)}
            className="w-full rounded-xl gradient-gold px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "جاري التنفيذ…" : needsSetup ? "إنشاء حساب المدير الأعلى" : "تسجيل الدخول"}
          </button>
        </div>
      </div>
    </div>
  );
}
