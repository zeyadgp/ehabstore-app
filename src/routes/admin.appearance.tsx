import { createFileRoute } from "@tanstack/react-router";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { ThemesManager } from "@/components/admin/ThemesManager";

export const Route = createFileRoute("/admin/appearance")({
  head: () => ({
    meta: [{ title: "المظهر والثيمات | لوحة التحكم" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminAppearance,
});

/**
 * Every store setting in one place — including fields the storefront does not
 * use yet — so future features can be switched on without a new screen.
 */
function AdminAppearance() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">إعدادات المظهر</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          تحكم بالثيمات وألوان المتجر وترتيب أزرار التنقل، بالإضافة إلى كل حقول الهوية والمحتوى. كل
          الحقول محفوظة في قاعدة البيانات وتظهر مباشرة في المتجر.
        </p>
      </div>

      <ThemesManager />

      <SettingsForm
        title="الهوية والعرض"
        fields={[
          { key: "store_name", label: "اسم المتجر" },
          {
            key: "require_email_confirm" as never,
            label: "طلب تأكيد البريد عند التسجيل",
            type: "boolean",
            hint: "عند التفعيل يُطلب من العميل تأكيد بريده قبل الدخول. الوضع الافتراضي: تسجيل مباشر بدون تحقق.",
          },
          { key: "logo", label: "الشعار", type: "image" },
          {
            key: "brand_text_color",
            label: "لون اسم المتجر",
            type: "select",
            options: [
              { value: "black", label: "أسود (افتراضي)" },
              { value: "gold", label: "ذهبي" },
              { value: "rose", label: "وردي" },
              { value: "gradient", label: "تدرّج ذهبي" },
            ],
          },
          {
            key: "grid_columns",
            label: "عدد المنتجات في الصف (الجوال)",
            type: "select",
            numeric: true,
            options: [
              { value: "2", label: "منتجان" },
              { value: "3", label: "ثلاثة منتجات" },
            ],
          },
          {
            key: "card_style",
            label: "شكل بطاقة المنتج",
            type: "select",
            options: [
              { value: "classic", label: "الشكل الحالي" },
              { value: "modern", label: "الشكل الجديد" },
            ],
          },
          {
            key: "swatch_enabled" as never,
            label: "إظهار عيّنات الألوان",
            type: "boolean",
          },
          {
            key: "swatch_shape" as never,
            label: "شكل عيّنة اللون",
            type: "select",
            options: [
              { value: "circle", label: "دائري" },
              { value: "square", label: "مربع" },
            ],
          },
          {
            key: "swatch_size" as never,
            label: "حجم عيّنة اللون",
            type: "select",
            options: [
              { value: "sm", label: "صغير" },
              { value: "md", label: "متوسط" },
              { value: "lg", label: "كبير" },
            ],
          },
          { key: "store_image", label: "صورة واجهة المتجر", type: "image" },
          { key: "hero_image", label: "صورة البانر الافتراضية", type: "image" },
          { key: "hero_title", label: "عنوان البانر" },
          { key: "hero_subtitle", label: "نص البانر الفرعي" },
        ]}
      />

      <SettingsForm
        title="العملة والتسعير"
        fields={[
          { key: "currency", label: "رمز العملة الأساسية", type: "ltr", hint: "مثال: SAR / YER" },
          { key: "currency_label", label: "اسم العملة الظاهر", hint: "مثال: ر.س" },
        ]}
      />

      <SettingsForm
        title="بيانات التواصل"
        fields={[
          {
            key: "whatsapp_number",
            label: "رقم واتساب الطلبات",
            type: "ltr",
            hint: "بصيغة دولية بدون +",
          },
          { key: "phone", label: "رقم الهاتف", type: "ltr" },
          { key: "email", label: "البريد الإلكتروني", type: "ltr" },
          { key: "address", label: "العنوان" },
          { key: "working_hours", label: "ساعات العمل" },
          {
            key: "app_download_url",
            label: "رابط تطبيق أندرويد (اختياري)",
            type: "ltr",
            hint: "رابط ملف APK أو تطبيقك في Google Play.",
          },
          {
            key: "ios_app_url",
            label: "رابط التطبيق في App Store (اختياري)",
            type: "ltr",
          },
          {
            key: "ios_badge_image",
            label: "صورة شارة App Store",
            type: "image",
            hint: "ارفع صورة الشارة الرسمية، أو اتركها فارغة لاستخدام الشكل الافتراضي.",
          },
          {
            key: "android_badge_image",
            label: "صورة شارة Google Play",
            type: "image",
            hint: "ارفع صورة الشارة الرسمية، أو اتركها فارغة لاستخدام الشكل الافتراضي.",
          },
        ]}
      />

      <SettingsForm
        title="روابط التواصل الاجتماعي"
        fields={[
          { key: "instagram", label: "إنستغرام", type: "ltr" },
          { key: "facebook", label: "فيسبوك", type: "ltr" },
          { key: "tiktok", label: "تيك توك", type: "ltr" },
          { key: "snapchat", label: "سناب شات", type: "ltr" },
          { key: "twitter", label: "إكس (تويتر)", type: "ltr" },
          { key: "youtube", label: "يوتيوب", type: "ltr" },
        ]}
      />

      <SettingsForm
        title="المحتوى النصي"
        fields={[
          { key: "description", label: "وصف المتجر", type: "textarea" },
          { key: "about", label: "نبذة مختصرة", type: "textarea" },
          { key: "about_content", label: "محتوى صفحة من نحن", type: "textarea" },
          { key: "contact_content", label: "محتوى صفحة تواصل معنا", type: "textarea" },
        ]}
      />

      <SettingsForm
        title="الفوتر وحقوق النشر"
        fields={[
          { key: "footer_text", label: "النص التعريفي في الفوتر", type: "textarea" },
          { key: "copyright_name", label: "اسم صاحب الحقوق" },
          {
            key: "copyright_url",
            label: "الرابط المخفي خلف اسم صاحب الحقوق",
            type: "ltr",
            hint: "لن يظهر الرابط كنص؛ يفتح فقط عند الضغط على الاسم.",
          },
        ]}
      />

      <SettingsForm
        title="تحسين الظهور في محركات البحث"
        fields={[
          { key: "seo_title", label: "عنوان SEO" },
          { key: "seo_description", label: "وصف SEO", type: "textarea" },
          { key: "seo_keywords", label: "الكلمات المفتاحية", type: "textarea" },
          { key: "og_image", label: "صورة المشاركة (Open Graph)", type: "image" },
        ]}
      />
    </div>
  );
}
