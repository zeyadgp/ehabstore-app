import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const title = "إعادة تعيين كلمة المرور | إيهاب ستور";
const description = "أدخل كلمة مرور جديدة لحسابك في متجر إيهاب ستور للعناية والتجميل.";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
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
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تحديث كلمة المرور");
    void navigate({ to: "/account" });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-center text-2xl font-extrabold">إعادة تعيين كلمة المرور</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        افتح هذه الصفحة من رابط الاستعادة المرسل إلى بريدك، ثم أدخل كلمة المرور الجديدة.
      </p>
      <form
        onSubmit={submit}
        className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-6 shadow-soft"
      >
        <label className="block text-xs font-bold" htmlFor="new-password">
          كلمة المرور الجديدة
          <input
            id="new-password"
            type="password"
            dir="ltr"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl gradient-gold py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          <KeyRound className="h-4 w-4" /> حفظ كلمة المرور
        </button>
      </form>
    </div>
  );
}
