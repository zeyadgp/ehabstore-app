import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Award,
  Camera,
  Loader2,
  LogIn,
  MapPin,
  Plus,
  Save,
  ShoppingBag,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SmartImage } from "@/components/SmartImage";
import { fallbackFor } from "@/lib/images";
import { YEMEN_GOVERNORATES, districtsFor } from "@/lib/yemen";
import { getLoyaltyOverview } from "@/lib/loyalty.functions";
import { myOrders, uploadAvatar } from "@/lib/account.functions";
import { compressToDataUrl } from "@/lib/image-compress";
import { LocationPicker } from "@/components/LocationPicker";
import { useCustomerProfile, useSessionUser, type SavedAddress } from "@/lib/account";
import { ReferralCard } from "@/components/ReferralCard";

const input =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

const STATUS_LABEL: Record<string, string> = {
  new: "جديد",
  reviewing: "قيد المراجعة",
  confirmed: "مؤكد",
  processing: "قيد التجهيز",
  ready: "جاهز للشحن",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  completed: "مكتمل",
  cancelled: "ملغي",
  returned: "مرتجع",
  no_contact: "تعذر التواصل",
  on_hold: "معلّق",
};

/** لوحة حساب العميل: الملف الشخصي، العناوين، النقاط، والطلبات. */
export function CustomerAccount() {
  const qc = useQueryClient();
  const { userId, loading } = useSessionUser();
  const { data: profile } = useCustomerProfile(userId);
  const fetchOrders = useServerFn(myOrders);
  const sendAvatar = useServerFn(uploadAvatar);
  const loyalty = useServerFn(getLoyaltyOverview);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    governorate: "",
    district: "",
    address: "",
    avatar_url: "",
  });
  const [coords, setCoords] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: null,
    longitude: null,
  });
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      governorate: profile.governorate ?? "",
      district: profile.district ?? "",
      address: profile.address ?? "",
      avatar_url: profile.avatar_url ?? "",
    });
    setAddresses(profile.addresses ?? []);
    setCoords({ latitude: profile.latitude ?? null, longitude: profile.longitude ?? null });
  }, [profile]);

  const { data: points } = useQuery({
    queryKey: ["my-loyalty", profile?.phone],
    enabled: !!profile?.phone,
    queryFn: () => loyalty({ data: { phone: profile!.phone! } }),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["my-orders", userId, profile?.phone],
    enabled: !!userId,
    queryFn: () => fetchOrders({ data: {} as never }),
  });

  if (loading) return null;

  if (!userId) {
    return (
      <section className="mt-4 rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
        <UserRound className="mx-auto h-8 w-8 text-primary" />
        <p className="mt-2 text-sm font-bold">سجّل الدخول لمتابعة طلباتك ونقاط الولاء</p>
        <Link
          to="/auth"
          className="mt-4 inline-flex items-center gap-2 rounded-xl gradient-gold px-5 py-3 text-sm font-bold text-primary-foreground"
        >
          <LogIn className="h-4 w-4" /> تسجيل الدخول أو إنشاء حساب
        </Link>
      </section>
    );
  }

  const phoneChanged = !!profile?.phone && profile.phone.trim() !== form.phone.trim();

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      ...form,
      addresses,
      latitude: coords.latitude,
      longitude: coords.longitude,
    } as never);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حفظ بياناتك");
    await qc.invalidateQueries({ queryKey: ["profile", userId] });
  };

  const pickAvatar = async (file: File) => {
    setBusy(true);
    try {
      const dataUrl = await compressToDataUrl(file, { maxSize: 512, quality: 0.8 });
      const res = await sendAvatar({ data: { dataUrl } });
      setForm((f) => ({ ...f, avatar_url: res.path }));
      toast.success("تم رفع الصورة، اضغط حفظ البيانات");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر رفع الصورة");
    } finally {
      setBusy(false);
    }
  };

  const addAddress = () => {
    setAddresses((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        label: "عنوان جديد",
        city: form.governorate,
        district: form.district,
        address: form.address,
        is_default: list.length === 0,
      },
    ]);
  };

  const patchAddress = (id: string, patch: Partial<SavedAddress>) =>
    setAddresses((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  return (
    <div className="mt-4 space-y-6">
      {/* بطاقة الملف الشخصي */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-4">
          <div className="relative">
            {form.avatar_url ? (
              <SmartImage
                paths={[form.avatar_url]}
                fallback={fallbackFor()}
                alt="صورة الحساب"
                className="h-16 w-16 rounded-2xl object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-gold text-primary-foreground">
                <UserRound className="h-8 w-8" />
              </span>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -end-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background"
              aria-label="تغيير الصورة"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickAvatar(f);
              }}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold">{form.full_name || "عميلنا العزيز"}</p>
            <p className="mt-1 flex items-center gap-1 text-xs font-bold text-primary">
              <Award className="h-3.5 w-3.5" /> {points?.points ?? 0} نقطة ولاء
              {points?.pendingPoints ? ` (+${points.pendingPoints} معلّقة)` : ""}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold">
            الاسم الكامل
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className={input}
            />
          </label>
          <label className="block text-xs font-bold">
            رقم الجوال
            <input
              dir="ltr"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={input}
            />
          </label>
          <label className="block text-xs font-bold">
            المحافظة
            <select
              value={form.governorate}
              onChange={(e) => setForm({ ...form, governorate: e.target.value, district: "" })}
              className={input}
            >
              <option value="">اختر المحافظة</option>
              {YEMEN_GOVERNORATES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold">
            المديرية / المنطقة
            <input
              list="acc-districts"
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
              className={input}
            />
            <datalist id="acc-districts">
              {districtsFor(form.governorate).map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </label>
          <label className="block text-xs font-bold sm:col-span-2">
            العنوان (الحي، الشارع، أقرب معلم)
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={input}
            />
          </label>
        </div>

        <div className="mt-4">
          <LocationPicker
            latitude={coords.latitude}
            longitude={coords.longitude}
            governorate={form.governorate}
            onPick={(loc) => {
              setCoords({ latitude: loc.latitude, longitude: loc.longitude });
              setForm((f) => ({
                ...f,
                governorate: loc.city || f.governorate,
                district: loc.district || f.district,
                address: loc.address || f.address,
              }));
            }}
          />
        </div>

        {phoneChanged && (
          <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-[11px] font-bold text-destructive">
            تنبيه: نقاط الولاء مرتبطة برقم الجوال. تغيير الرقم يعني بدء رصيد جديد ولن تنتقل النقاط
            تلقائياً.
          </p>
        )}

        <button
          onClick={() => void save()}
          disabled={busy}
          className="mt-4 flex items-center gap-2 rounded-xl gradient-gold px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> حفظ البيانات
        </button>
      </section>

      <ReferralCard />

      {/* العناوين المحفوظة */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-bold">
            <MapPin className="h-4 w-4 text-primary" /> العناوين المحفوظة
          </p>
          <button
            onClick={addAddress}
            className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-[11px] font-bold text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> إضافة عنوان
          </button>
        </div>

        {addresses.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">لا توجد عناوين محفوظة بعد.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {addresses.map((a) => (
              <div key={a.id} className="rounded-2xl border border-border p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={a.label}
                    onChange={(e) => patchAddress(a.id, { label: e.target.value })}
                    placeholder="اسم العنوان (المنزل/العمل)"
                    className={input}
                  />
                  <select
                    value={a.city}
                    onChange={(e) => patchAddress(a.id, { city: e.target.value, district: "" })}
                    className={input}
                  >
                    <option value="">المحافظة</option>
                    {YEMEN_GOVERNORATES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <input
                    value={a.district}
                    onChange={(e) => patchAddress(a.id, { district: e.target.value })}
                    placeholder="المديرية"
                    className={input}
                  />
                  <input
                    value={a.address}
                    onChange={(e) => patchAddress(a.id, { address: e.target.value })}
                    placeholder="الحي، الشارع، أقرب معلم"
                    className={input}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-[11px] font-bold">
                    <input
                      type="radio"
                      name="default-address"
                      checked={a.is_default}
                      onChange={() =>
                        setAddresses((list) =>
                          list.map((x) => ({ ...x, is_default: x.id === a.id })),
                        )
                      }
                    />
                    العنوان الافتراضي
                  </label>
                  <button
                    onClick={() => setAddresses((list) => list.filter((x) => x.id !== a.id))}
                    className="flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-1 text-[11px] font-bold text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          اضغط «حفظ البيانات» بالأعلى لتخزين التعديلات.
        </p>
      </section>

      {/* طلباتي */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <p className="flex items-center gap-2 text-sm font-bold">
          <ShoppingBag className="h-4 w-4 text-primary" /> طلباتي
        </p>
        {orders.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">لا توجد طلبات مرتبطة برقم جوالك بعد.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {orders.map((o) => (
              <li key={o.id} className="rounded-2xl border border-border p-3 text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span>طلب #{o.order_number}</span>
                  <span className="rounded-lg bg-secondary px-2 py-0.5 text-primary">
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {o.items.map((i) => `${i.product_name} ×${i.quantity}`).join("، ")}
                </p>
                <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
                  <p className="font-bold text-foreground">
                    {Number(o.total).toLocaleString("ar-EG")} {o.currency_label}
                  </p>
                  <Link
                    to="/orders"
                    search={{
                      order: String(o.order_number),
                      phone: profile?.phone ?? undefined,
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary/10"
                  >
                    <Truck className="h-3 w-3" />
                    <span>تتبع مسار الطلب</span>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
