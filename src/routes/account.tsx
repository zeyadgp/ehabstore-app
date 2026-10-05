import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Award,
  Heart,
  Megaphone,
  LogIn,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingBag,
  Store,
  UserRound,
} from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import { useCurrency } from "@/lib/currency";
import { useSettings } from "@/lib/store";
import { BrandMark } from "@/components/BrandMark";
import { CustomerAccount } from "@/components/CustomerAccount";
import { ChangeEmailCard } from "@/components/ChangeEmailCard";
import { SmartImage } from "@/components/SmartImage";
import { fallbackFor } from "@/lib/images";
import { useCustomerProfile, useSessionUser } from "@/lib/account";
import { getLoyaltyOverview } from "@/lib/loyalty.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

const title = "حسابي | إيهاب ستور للعناية والتجميل";
const description = "صفحة حسابك في إيهاب ستور: المفضلة، السلة، العملة، وطرق التواصل مع المتجر.";

export const Route = createFileRoute("/account")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://ehabstore.app/account" }],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { data: settings } = useSettings();
  const { email } = useAdmin();
  const { ids } = useFavorites();
  const { count, total } = useCart();
  const { code, setCode, currencies, format } = useCurrency();
  const { userId } = useSessionUser();
  const { data: profile } = useCustomerProfile(userId);
  const loyalty = useServerFn(getLoyaltyOverview);
  const phone = profile?.phone?.trim() ?? "";
  const { data: points } = useQuery({
    queryKey: ["loyalty-points", phone],
    enabled: !!userId && phone.length > 5,
    staleTime: 60_000,
    queryFn: async () => (await loyalty({ data: { phone } })).points ?? 0,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            <SmartImage
              paths={[profile.avatar_url]}
              fallback={fallbackFor("avatar")}
              alt={profile.full_name ?? "صورة الحساب"}
              className="h-14 w-14 rounded-2xl object-cover"
              eager
            />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-gold text-primary-foreground">
              <UserRound className="h-7 w-7" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold">{profile?.full_name?.trim() || "حسابي"}</h1>
            <p dir={email ? "ltr" : undefined} className="truncate text-xs text-muted-foreground">
              {email ?? "زائر — لا حاجة لحساب لإتمام الطلب عبر واتساب"}
            </p>
          </div>
          {userId && (
            <Link
              to="/loyalty"
              className="flex shrink-0 flex-col items-center rounded-2xl border border-border px-3 py-2 text-center transition-colors hover:border-primary"
            >
              <Award className="h-4 w-4 text-primary" />
              <span className="mt-1 text-sm font-extrabold text-primary">{points ?? 0}</span>
              <span className="text-[10px] text-muted-foreground">نقطة ولاء</span>
            </Link>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Link
          to="/favorites"
          className="rounded-3xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-primary"
        >
          <Heart className="h-5 w-5 text-rose" />
          <p className="mt-3 text-sm font-bold">المفضلة</p>
          <p className="text-xs text-muted-foreground">{ids.length} منتج</p>
        </Link>
        <Link
          to="/cart"
          className="rounded-3xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-primary"
        >
          <ShoppingBag className="h-5 w-5 text-primary" />
          <p className="mt-3 text-sm font-bold">السلة</p>
          <p className="text-xs text-muted-foreground">
            {count} منتج · {format(total)}
          </p>
        </Link>
        <Link
          to="/products"
          className="rounded-3xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-primary"
        >
          <Store className="h-5 w-5 text-primary" />
          <p className="mt-3 text-sm font-bold">المتجر</p>
          <p className="text-xs text-muted-foreground">تصفّحي كل المنتجات</p>
        </Link>
        <Link
          to="/loyalty"
          className="rounded-3xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-primary sm:col-span-3"
        >
          <Award className="h-5 w-5 text-primary" />
          <p className="mt-3 text-sm font-bold">نادي الولاء</p>
          <p className="text-xs text-muted-foreground">
            اعرف رصيد نقاطك، شارك رابط إحالتك، واستبدل مكافآتك وكوبونات الخصم
          </p>
        </Link>
        <Link
          to="/influencer"
          className="rounded-3xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-primary sm:col-span-3"
        >
          <Megaphone className="h-5 w-5 text-primary" />
          <p className="mt-3 text-sm font-bold">برنامج المؤثرين</p>
          <p className="text-xs text-muted-foreground">
            رابطك التسويقي، العمولات وطلبات سحب الأرباح
          </p>
        </Link>
      </div>

      {currencies.length > 1 && (
        <div className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-soft">
          <p className="text-sm font-bold">العملة المفضلة</p>
          <select
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label="اختيار العملة"
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <CustomerAccount />

      {userId && <ChangeEmailCard currentEmail={email} />}

      <div className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <BrandMark size="sm" asLink={false} />
        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
          {settings?.whatsapp_number && (
            <li className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <a
                href={`https://wa.me/${settings.whatsapp_number}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary"
              >
                تواصل عبر واتساب
              </a>
            </li>
          )}
          <li className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            <span dir="ltr">{settings?.phone ?? "+967780187409"}</span>
          </li>
          {settings?.address && (
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span>{settings.address}</span>
            </li>
          )}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <Link
            to="/about"
            className="rounded-xl border border-border px-4 py-2 hover:border-primary"
          >
            من نحن
          </Link>
          <Link
            to="/contact"
            className="rounded-xl border border-border px-4 py-2 hover:border-primary"
          >
            تواصل معنا
          </Link>
        </div>
      </div>

      {!email && (
        <div className="mt-4 rounded-3xl border border-border bg-card p-5 text-xs font-bold shadow-soft">
          <Link to="/auth" className="flex items-center gap-2 hover:text-primary">
            <LogIn className="h-4 w-4" /> تسجيل الدخول
          </Link>
        </div>
      )}
    </div>
  );
}
