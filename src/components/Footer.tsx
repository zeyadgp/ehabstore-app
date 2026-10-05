import {
  Bot,
  Clock,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Music2,
  Phone,
  Send,
  ShoppingBag,
  Store,
  Twitter,
  Youtube,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";
import { InstallApp } from "@/components/InstallApp";
import { useAdmin } from "@/hooks/useAdmin";
import { useSettings } from "@/lib/store";

export function Footer() {
  const { data: settings } = useSettings();
  const { isAdmin } = useAdmin();

  const socials = [
    {
      href: settings?.whatsapp_number
        ? `https://wa.me/${settings.whatsapp_number.replace(/\D/g, "")}`
        : null,
      label: "واتساب",
      icon: MessageCircle,
    },
    { href: settings?.instagram, label: "إنستغرام", icon: Instagram },
    { href: settings?.facebook, label: "فيسبوك", icon: Facebook },
    { href: settings?.tiktok, label: "تيك توك", icon: Music2 },
    { href: settings?.snapchat, label: "سناب شات", icon: Send },
    { href: settings?.twitter, label: "إكس (تويتر)", icon: Twitter },
    { href: settings?.youtube, label: "يوتيوب", icon: Youtube },
    { href: settings?.meta_shop_url, label: "متجر فيسبوك", icon: ShoppingBag },
    { href: settings?.instagram_shop_url, label: "متجر إنستغرام", icon: Store },
  ].filter((s) => Boolean(s.href));

  const whatsapp = settings?.whatsapp_number;

  return (
    <footer className="mt-16 border-t border-border bg-card pb-28">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-2">
        <div>
          <BrandMark size="md" />
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {settings?.footer_text ??
              settings?.about ??
              "متجر متخصص في منتجات العناية بالبشرة والشعر والمكياج والعطور بجودة أصلية مضمونة."}
          </p>
          {socials.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href as string}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-primary transition-colors hover:gradient-gold hover:text-primary-foreground"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-base font-bold">تواصل معنا</h3>
          <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
            {whatsapp && (
              <li className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-primary"
                >
                  الطلب عبر واتساب
                </a>
              </li>
            )}
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              <span dir="ltr">{settings?.phone ?? "+967780187409"}</span>
            </li>
            {settings?.email && (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <span dir="ltr">{settings.email}</span>
              </li>
            )}
            {settings?.address && (
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{settings.address}</span>
              </li>
            )}
            {settings?.working_hours && (
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span>{settings.working_hours}</span>
              </li>
            )}
          </ul>
          <InstallApp className="mt-5" />
        </div>
      </div>

      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        <Link
          to="/connect"
          className="mb-3 inline-flex items-center gap-1.5 font-bold text-foreground hover:text-primary"
        >
          <Bot className="h-4 w-4" /> ربط المساعد الذكي
        </Link>
        <div>
          © {new Date().getFullYear()}{" "}
          {settings?.copyright_url && settings?.copyright_name ? (
            <a
              href={settings.copyright_url}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-foreground hover:text-primary"
            >
              {settings.copyright_name}
            </a>
          ) : (
            (settings?.copyright_name ?? settings?.store_name ?? "إيهاب ستور للعناية والتجميل")
          )}{" "}
          — جميع الحقوق محفوظة
          {isAdmin && (
            <>
              {" "}
              ·{" "}
              <Link to="/admin" className="hover:text-primary">
                لوحة التحكم
              </Link>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
