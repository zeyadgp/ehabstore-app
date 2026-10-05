import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Plus, Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { useAdminTestimonials, type AdminTestimonial } from "@/lib/admin";
import { ReviewsManager } from "@/components/admin/ReviewsManager";
import { useAdmin } from "@/hooks/useAdmin";

export const Route = createFileRoute("/admin/content")({
  head: () => ({
    meta: [{ title: "محتوى المتجر | لوحة التحكم" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminContent,
});

function AdminContent() {
  return (
    <div className="space-y-10">
      <SettingsForm
        title="تخصيص صفحة «من نحن»"
        fields={[
          {
            key: "store_image",
            label: "صورة صفحة من نحن (صورة المتجر)",
            type: "image",
            hint: "الصورة الرئيسية التي تظهر أعلى صفحة من نحن في المتجر.",
          },
          {
            key: "about_content",
            label: "محتوى ونص صفحة من نحن بالتفصيل",
            type: "textarea",
            hint: "اكتب قصة المتجر ورؤيته وأهدافه. يمكنك الفصل بين الفقرات بالضغط على Enter.",
          },
          {
            key: "about",
            label: "نبذة تعريفية مختصرة (تظهر كعنوان فرعي وفي التذييل)",
            type: "textarea",
            hint: "نبذة مركزة وسريعة تلخص هوية المتجر.",
          },
        ]}
      />

      <SettingsForm
        title="محتوى الواجهة والبانر والاتصال"
        fields={[
          { key: "hero_title", label: "عنوان البانر الرئيسي" },
          { key: "hero_subtitle", label: "نص البانر الفرعي" },
          { key: "hero_image", label: "صورة البانر الرئيسي", type: "image" },
          { key: "contact_content", label: "محتوى صفحة تواصل معنا", type: "textarea" },
        ]}
      />

      <TestimonialsManager />
      <ReviewsManager />
    </div>
  );
}

function TestimonialsManager() {
  const qc = useQueryClient();
  const { data: list = [] } = useAdminTestimonials();
  const { can, isViewer, isAddOnly } = useAdmin();
  const canAdd = can("add_content") && !isViewer;
  const canEdit = can("manage_content") && !isViewer && !isAddOnly;
  const canDelete = can("delete_content") && !isViewer && !isAddOnly;

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(5);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin", "testimonials"] });
    await qc.invalidateQueries({ queryKey: ["testimonials"] });
  };

  const add = async () => {
    if (!name.trim() || !content.trim()) {
      toast.error("الاسم والنص مطلوبان");
      return;
    }
    const { error } = await supabase
      .from("testimonials")
      .insert({ customer_name: name.trim(), content: content.trim(), rating });
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setContent("");
    toast.success("تمت إضافة الرأي");
    await refresh();
  };

  const toggle = async (t: AdminTestimonial) => {
    const { error } = await supabase
      .from("testimonials")
      .update({ is_visible: !t.is_visible })
      .eq("id", t.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
  };

  const remove = async (t: AdminTestimonial) => {
    if (!confirm("حذف هذا الرأي؟")) return;
    const { error } = await supabase.from("testimonials").delete().eq("id", t.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-extrabold">آراء العملاء</h2>

      {canAdd && (
        <div className="grid gap-3 rounded-3xl border border-border bg-card p-5 shadow-soft sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم العميلة"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r} نجوم
              </option>
            ))}
          </select>
          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="نص الرأي"
            className="sm:col-span-2 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={add}
            className="flex items-center justify-center gap-2 rounded-xl gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground sm:col-span-2"
          >
            <Plus className="h-4 w-4" /> إضافة رأي
          </button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {list.map((t) => (
          <div key={t.id} className="rounded-3xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">{t.customer_name}</span>
              <span className="flex text-primary">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Heart key={i} className="h-3 w-3 fill-current" />
                ))}
              </span>
              {canEdit && (
                <button
                  onClick={() => toggle(t)}
                  className="ms-auto rounded-lg bg-secondary p-2 text-primary"
                >
                  {t.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => remove(t)}
                  className={`rounded-lg bg-destructive/10 p-2 text-destructive ${!canEdit ? "ms-auto" : ""}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">{t.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
