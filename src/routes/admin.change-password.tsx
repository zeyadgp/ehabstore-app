import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/change-password")({
  head: () => ({
    meta: [{ title: "تغيير كلمة المرور | لوحة التحكم" }, { name: "robots", content: "noindex" }],
  }),
  component: ChangePassword,
});

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (next.length < 8) {
      toast.error("كلمة المرور يجب أن تكون ٨ أحرف على الأقل");
      return;
    }
    if (next !== confirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      password: next,
      current_password: current,
    } as never);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    toast.success("تم تحديث كلمة المرور");
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <h1 className="text-2xl font-extrabold">تغيير كلمة المرور</h1>
      <div className="space-y-3 rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <KeyRound className="h-4 w-4" /> اختر كلمة مرور قوية لا تقل عن ٨ أحرف
        </div>
        <input
          dir="ltr"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="كلمة المرور الحالية"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <input
          dir="ltr"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="كلمة المرور الجديدة"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <input
          dir="ltr"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="تأكيد كلمة المرور الجديدة"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => void submit()}
          disabled={busy}
          className="w-full rounded-xl gradient-gold px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "جاري الحفظ…" : "حفظ"}
        </button>
      </div>
    </div>
  );
}
