import { createFileRoute } from "@tanstack/react-router";
import { Instagram, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useSettings } from "@/lib/store";
import { whatsappLink } from "@/lib/whatsapp";

const title = "تواصل معنا | إيهاب ستور للعناية والتجميل";
const description = "تواصلي مع إيهاب ستور عبر واتساب أو الهاتف أو البريد الإلكتروني لأي استفسار.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:image", content: "https://www.ehabstore.app/icon-512.png" },
      { name: "twitter:image", content: "https://www.ehabstore.app/icon-512.png" },
      { property: "og:description", content: description },
      { property: "og:url", content: "https://ehabstore.app/contact" },
    ],
    links: [{ rel: "canonical", href: "https://ehabstore.app/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { data: settings } = useSettings();
  const wa = whatsappLink(
    settings?.whatsapp_number ?? "+967780187409",
    `مرحباً ${settings?.store_name ?? "إيهاب ستور"}، لدي استفسار.`,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-center text-3xl font-extrabold">تواصل معنا</h1>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        فريقنا جاهز للرد على استفساراتك ومساعدتك في اختيار المنتج المناسب.
      </p>

      <a
        href={wa}
        target="_blank"
        rel="noreferrer"
        className="mt-8 flex items-center justify-center gap-2 rounded-2xl gradient-gold py-4 text-sm font-bold text-primary-foreground shadow-soft"
      >
        <MessageCircle className="h-5 w-5" /> راسلينا على واتساب
      </a>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <InfoRow icon={Phone} label="الهاتف" value={settings?.phone ?? "+967780187409"} ltr />
        {settings?.email && <InfoRow icon={Mail} label="البريد" value={settings.email} ltr />}
        {settings?.address && <InfoRow icon={MapPin} label="العنوان" value={settings.address} />}
        {settings?.instagram && (
          <InfoRow icon={Instagram} label="إنستغرام" value={settings.instagram} ltr />
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  ltr,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold" dir={ltr ? "ltr" : undefined}>
          {value}
        </p>
      </div>
    </div>
  );
}
