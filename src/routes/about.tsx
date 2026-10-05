import { createFileRoute } from "@tanstack/react-router";
import { Gem, HeartHandshake } from "lucide-react";
import { StoreLogo } from "@/components/StoreLogo";
import hero from "@/assets/hero.jpg";
import { SmartImage } from "@/components/SmartImage";
import { useSettings } from "@/lib/store";

const title = "من نحن | إيهاب ستور للعناية والتجميل";
const description =
  "تعرّفي على إيهاب ستور: متجر متخصص في منتجات العناية بالبشرة والشعر والمكياج والعطور الأصلية.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:image", content: "https://www.ehabstore.app/icon-512.png" },
      { name: "twitter:image", content: "https://www.ehabstore.app/icon-512.png" },
      { property: "og:description", content: description },
      { property: "og:url", content: "https://ehabstore.app/about" },
    ],
    links: [{ rel: "canonical", href: "https://ehabstore.app/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { data: settings } = useSettings();

  const imagePath = settings?.store_image?.trim() || null;
  const mainText =
    settings?.about_content?.trim() ||
    settings?.about?.trim() ||
    "إيهاب ستور متجر متخصص في منتجات العناية بالبشرة والشعر والمكياج والعطور. نختار لك منتجات أصلية من علامات موثوقة، ونحرص على تقديم تجربة تسوق بسيطة وسريعة عبر واتساب.";

  // تجزئة النص إلى فقرات منفصلة في حال احتوائه على أسطر متعددة
  const paragraphs = mainText.split(/\n+/).filter((p) => p.trim().length > 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-center text-3xl font-extrabold">من نحن</h1>

      {imagePath ? (
        <div className="mt-8 overflow-hidden rounded-3xl shadow-lift">
          <SmartImage
            paths={[imagePath]}
            fallback={hero}
            alt={settings?.store_name ?? "إيهاب ستور للعناية والتجميل"}
            className="h-72 w-full object-cover sm:h-96 md:h-[420px]"
          />
        </div>
      ) : (
        <img
          src={hero}
          alt={settings?.store_name ?? "إيهاب ستور للعناية والتجميل"}
          loading="lazy"
          width={1600}
          height={1008}
          className="mt-8 w-full rounded-3xl object-cover shadow-lift"
        />
      )}

      {settings?.about && settings?.about_content && (
        <p className="mt-8 text-center text-base font-semibold leading-8 text-foreground md:text-lg">
          {settings.about}
        </p>
      )}

      <div className="mt-6 space-y-4 text-center text-sm leading-8 text-muted-foreground md:text-base">
        {paragraphs.map((para, idx) => (
          <p key={idx} className="leading-relaxed">
            {para}
          </p>
        ))}
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          { icon: Gem, t: "جودة أصلية", d: "منتجات مضمونة من مصادر موثوقة" },
          { icon: HeartHandshake, t: "ثقة العميلات", d: "خدمة ودعم سريع في كل خطوة" },
          { icon: StoreLogo, t: "اختيار مدروس", d: "تشكيلة منتقاة تناسب كل احتياج" },
        ].map((c) => (
          <div
            key={c.t}
            className="rounded-2xl border border-border bg-card p-5 text-center shadow-soft"
          >
            <c.icon className="mx-auto h-7 w-7 text-primary" />
            <h2 className="mt-3 text-base font-bold">{c.t}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{c.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
