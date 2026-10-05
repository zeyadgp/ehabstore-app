import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ExternalLink, Facebook, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/meta-guide")({
  head: () => ({
    meta: [
      { title: "دليل ربط Meta والإعلانات | لوحة التحكم" },
      {
        name: "description",
        content: "دليل إعداد ربط متجر إيهاب مع Meta والإعلانات والكتالوج خطوة بخطوة.",
      },
      { property: "og:title", content: "دليل ربط Meta والإعلانات | لوحة التحكم" },
      {
        property: "og:description",
        content: "دليل إعداد ربط متجر إيهاب مع Meta والإعلانات والكتالوج خطوة بخطوة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MetaGuidePage,
});

const steps = [
  [
    "جهّز حساب الأعمال",
    "افتح حساب Meta Business وتأكد أن صفحة فيسبوك وحساب إنستغرام وحساب الإعلانات مضافة إليه.",
  ],
  [
    "أنشئ تطبيق أعمال",
    "من منصة مطوري فيسبوك أنشئ تطبيقاً من نوع الأعمال، ثم انسخ معرّف التطبيق إلى صفحة إعدادات Meta في المتجر.",
  ],
  [
    "اضبط نطاق المتجر",
    "أضف ehabstore.app ضمن النطاقات المسموح بها، وأضف رابط الصفحة الرسمية ضمن روابط تسجيل الدخول المسموحة.",
  ],
  [
    "سجّل الدخول من فيسبوك",
    "ارجع إلى إعدادات Meta واضغط «تسجيل الدخول عبر فيسبوك»، ثم وافق على الصفحة وإنستغرام وحساب الإعلانات والكتالوج.",
  ],
  [
    "اربط البيكسل",
    "أنشئ Meta Pixel من مدير الأحداث، ثم ضع معرّفه ورمز Conversions API في الحقول المخصصة واحفظ الإعدادات.",
  ],
  [
    "زامن الكتالوج",
    "اختر الكتالوج التجاري واضغط مزامنة المنتجات، ثم راجع ظهور الصور والأسعار والفئات وروابط المنتجات.",
  ],
  [
    "اختبر الاتصال",
    "اضغط فحص الاتصال ثم أرسل حدثاً تجريبياً. يجب أن تظهر نتيجة ناجحة قبل تشغيل الحملات.",
  ],
  [
    "أنشئ الإعلان",
    "انتقل إلى إدارة الإعلانات، اختر المنتج والجمهور والميزانية، واحفظ الحملة كمسودة للمراجعة قبل النشر.",
  ],
] as const;

function MetaGuidePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div className="border-b border-border pb-5">
        <Link
          to="/admin/meta"
          className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
        >
          <ArrowRight className="h-4 w-4" /> العودة إلى إعدادات Meta
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Facebook className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">دليل ربط Meta والإعلانات</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              اتبع الخطوات بالترتيب حتى يعمل الربط والكتالوج والتتبع بصورة صحيحة.
            </p>
          </div>
        </div>
      </div>
      <ol className="grid gap-4 sm:grid-cols-2">
        {steps.map(([title, body], index) => (
          <li
            key={title}
            className="flex gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">
              {index + 1}
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-foreground">{title}</h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
          <p className="text-xs leading-6 text-muted-foreground">
            <strong className="text-foreground">تنبيه:</strong> لا تشارك رمز الوصول أو رمز CAPI مع
            أي شخص، واحفظه فقط داخل إعدادات المتجر.
          </p>
        </div>
        <a
          href="https://business.facebook.com/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground"
        >
          <ExternalLink className="h-4 w-4" /> فتح Meta Business
        </a>
      </div>
      <div className="text-center">
        <Link
          to="/admin/meta"
          className="inline-flex items-center gap-2 rounded-2xl gradient-gold px-6 py-3 text-sm font-extrabold text-primary-foreground"
        >
          <CheckCircle2 className="h-4 w-4" /> بدء الربط الآن
        </Link>
      </div>
    </div>
  );
}
