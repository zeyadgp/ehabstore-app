import { useState } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** تغيير البريد الإلكتروني للحساب بعد إدخال كود تحقق يصل للبريد الجديد. */
export function ChangeEmailCard({ currentEmail }: { currentEmail: string | null }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    const next = email.trim();
    if (!next.includes("@")) {
      toast.error("أدخل بريداً صحيحاً");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: next });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("أرسلنا كود التحقق إلى البريد الجديد");
  };

  const verify = async () => {
    const token = code.trim();
    if (token.length < 6) {
      toast.error("أدخل كود التحقق المكوّن من ٦ أرقام");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email_change",
    });
    setBusy(false);
    if (error) {
      toast.error("الكود غير صحيح أو منتهي");
      return;
    }
    toast.success("تم تغيير البريد بنجاح");
    setSent(false);
    setCode("");
  };

  return (
    <div className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-primary" />
        <p className="text-sm font-bold">تغيير البريد الإلكتروني</p>
      </div>
      {currentEmail && (
        <p dir="ltr" className="mt-1 truncate text-right text-xs text-muted-foreground">
          {currentEmail}
        </p>
      )}

      <div className="mt-3 space-y-2.5">
        <input
          dir="ltr"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="البريد الجديد"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        {!sent ? (
          <button
            onClick={() => void sendCode()}
            disabled={busy || !email}
            className="w-full rounded-xl gradient-gold px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "جاري الإرسال…" : "إرسال كود التحقق"}
          </button>
        ) : (
          <>
            <input
              dir="ltr"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="كود التحقق"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-center text-sm tracking-widest outline-none focus:border-primary"
            />
            <button
              onClick={() => void verify()}
              disabled={busy || !code}
              className="flex w-full items-center justify-center gap-2 rounded-xl gradient-gold px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              {busy ? "جاري التأكيد…" : "تأكيد وتغيير البريد"}
            </button>
            <button
              onClick={() => void sendCode()}
              disabled={busy}
              className="w-full text-xs font-bold text-muted-foreground hover:text-primary"
            >
              إعادة إرسال الكود
            </button>
          </>
        )}
      </div>
    </div>
  );
}
