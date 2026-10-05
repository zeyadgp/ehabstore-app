import { createFileRoute } from "@tanstack/react-router";
import { PackageCheck, RotateCcw, ShieldCheck, XCircle } from "lucide-react";

const title = "سياسة الإلغاء والإرجاع | إيهاب ستور";
const description =
  "تعرفي على شروط إلغاء الطلب وإرجاع المنتجات واسترداد المبلغ في إيهاب ستور خلال المدة المسموحة.";

export const Route = createFileRoute("/policy")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:image", content: "https://www.ehabstore.app/icon-512.png" },
      { name: "twitter:image", content: "https://www.ehabstore.app/icon-512.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://ehabstore.app/policy" }],
  }),
  component: PolicyPage,
});

const sections = [
  {
    icon: XCircle,
    title: "إلغاء الطلب",
    items: [
      "يمكنك إلغاء الطلب مجاناً ما دام في حالة «جديد» أو «قيد المراجعة».",
      "بعد شحن الطلب لا يمكن الإلغاء، ويمكن رفضه عند الاستلام مع تحمّل رسوم التوصيل.",
      "للإلغاء تواصلي معنا عبر واتساب مع ذكر رقم الطلب.",
    ],
  },
  {
    icon: RotateCcw,
    title: "الإرجاع والاستبدال",
    items: [
      "مدة الإرجاع 3 أيام من تاريخ الاستلام.",
      "يجب أن يكون المنتج بحالته الأصلية وبغلافه غير مفتوح.",
      "منتجات العناية والمكياج والعطور المفتوحة لا تُرجع لأسباب صحية.",
      "الاستبدال متاح إذا وصل المنتج تالفاً أو مختلفاً عن الطلب، ونتحمّل نحن تكلفة الشحن في هذه الحالة.",
    ],
  },
  {
    icon: PackageCheck,
    title: "استرداد المبلغ",
    items: [
      "يتم الاسترداد خلال 3 أيام عمل بعد فحص المنتج المرتجع.",
      "يُعاد المبلغ بنفس وسيلة الدفع أو كرصيد داخل المتجر حسب رغبتك.",
      "رسوم التوصيل غير مستردة إلا إذا كان الخطأ من المتجر.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "ضمان الأصالة",
    items: [
      "كل المنتجات أصلية 100% ومن مصادر معتمدة.",
      "في حال ثبوت خلاف ذلك نسترد المبلغ كاملاً مع رسوم التوصيل.",
    ],
  },
];

function PolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32">
      <h1 className="text-2xl font-extrabold">سياسة الإلغاء والإرجاع</h1>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        راحتك أولويتنا — هذه الشروط تنظّم إلغاء الطلبات وإرجاع المنتجات لضمان حقك وحقنا.
      </p>

      <div className="mt-6 space-y-4">
        {sections.map((s) => (
          <section
            key={s.title}
            className="rounded-3xl border border-border bg-card p-5 shadow-soft"
          >
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-secondary text-primary">
                <s.icon className="h-4 w-4" />
              </span>
              {s.title}
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-7 text-muted-foreground">
              {s.items.map((i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-6 rounded-3xl border border-dashed border-border p-5 text-center text-xs leading-6 text-muted-foreground">
        لأي استفسار حول طلبك تواصلي معنا عبر واتساب وسنساعدك فوراً 💛
      </p>
    </div>
  );
}
