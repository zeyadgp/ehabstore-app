import { lazy, Suspense, useEffect, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, Crosshair, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { reverseGeocode } from "@/lib/geo.functions";
import { centerFor } from "@/lib/yemen";

const MapPicker = lazy(() => import("@/components/MapPicker"));

export type PickedLocation = {
  latitude: number;
  longitude: number;
  city: string;
  district: string;
  address: string;
};

/**
 * تحديد الموقع: زر GPS + خريطة تفاعلية أسفل الزر تفتح على مركز المحافظة المختارة
 * للاختيار اليدوي، مع تحويل الإحداثيات إلى عنوان تلقائيًا.
 */
export function LocationPicker({
  latitude,
  longitude,
  governorate,
  onPick,
}: {
  latitude?: number | null;
  longitude?: number | null;
  governorate?: string;
  onPick: (loc: PickedLocation) => void;
}) {
  const geocode = useServerFn(reverseGeocode);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [manual, setManual] = useState(false);

  const hasCoords = latitude != null && longitude != null;
  const center = centerFor(governorate);
  const lat = hasCoords ? latitude! : center.lat;
  const lng = hasCoords ? longitude! : center.lng;

  // نفتح الخريطة تلقائيًا عند اختيار المحافظة أو وجود إحداثيات محفوظة
  useEffect(() => {
    if (hasCoords || governorate) setManual(true);
  }, [hasCoords, governorate]);

  const applyCoords = async (la: number, ln: number, silent = false) => {
    let info = { city: "", district: "", address: "" };
    try {
      info = await geocode({ data: { lat: la, lng: ln } });
    } catch {
      /* نكتفي بالإحداثيات إذا تعذر تحويل العنوان */
    }
    onPick({ latitude: la, longitude: ln, ...info });
    if (!silent) toast.success("تم تحديد موقعك، يمكنك تعديل العنوان يدويًا");
  };

  const detect = async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setManual(true);
      toast.error("المتصفح لا يدعم تحديد الموقع، حدّدي الموقع من الخريطة");
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setManual(true);
      toast.error("تحديد الموقع يحتاج اتصالًا آمنًا (HTTPS) — استخدم الخريطة");
      return;
    }
    try {
      const perm = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
      if (perm?.state === "denied") {
        setDenied(true);
        setManual(true);
        toast.error("إذن الموقع مرفوض — فعّليه من إعدادات المتصفح أو حدّدي الموقع من الخريطة");
        return;
      }
    } catch {
      /* بعض المتصفحات لا تدعم permissions API */
    }

    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setDenied(false);
        await applyCoords(pos.coords.latitude, pos.coords.longitude);
        setManual(true);
        setBusy(false);
      },
      (err) => {
        setBusy(false);
        setManual(true);
        if (err.code === err.PERMISSION_DENIED) {
          setDenied(true);
          toast.error(
            "تم رفض إذن الموقع — فعّلي الإذن ثم أعيدي المحاولة، أو حدّدي الموقع من الخريطة",
          );
        } else if (err.code === err.TIMEOUT) {
          toast.error("انتهت مهلة تحديد الموقع — حدّدي موقعك من الخريطة");
        } else {
          toast.error("تعذر تحديد الموقع — حدّدي موقعك من الخريطة");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <div className="rounded-2xl border border-border bg-secondary/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold">تحديد الموقع على الخريطة</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void detect()}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl gradient-gold px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Crosshair className="h-4 w-4" />
            )}
            استخدام موقعي الحالي
          </button>
          <button
            type="button"
            onClick={() => setManual((m) => !m)}
            className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold"
          >
            <MapPin className="h-4 w-4 text-primary" />
            {manual ? "إخفاء الخريطة" : "اختيار من الخريطة"}
          </button>
        </div>
      </div>

      {denied && (
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-destructive/10 p-2 text-[11px] font-bold text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            إذن الموقع مغلق. افتح قفل العنوان في المتصفح ← إعدادات الموقع ← السماح بالموقع، ثم أعيدي
            الضغط على «استخدام موقعي الحالي». أو حدّدي موقعك يدويًا من الخريطة بالأسفل.
          </span>
        </div>
      )}

      {manual && (
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <ClientOnly fallback={<div className="h-56 w-full animate-pulse bg-muted" />}>
            <Suspense fallback={<div className="h-56 w-full animate-pulse bg-muted" />}>
              <MapPicker
                latitude={lat}
                longitude={lng}
                zoom={hasCoords ? 15 : 11}
                onChange={(la, ln) => void applyCoords(la, ln, true)}
              />
            </Suspense>
          </ClientOnly>
          <p className="bg-background px-3 py-2 text-[11px] text-muted-foreground">
            اضغط على الخريطة أو اسحبي المؤشر لتحديد موقعك بدقة
            {governorate ? ` داخل ${governorate}` : ""}.
          </p>
        </div>
      )}

      {hasCoords && (
        <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
          <p dir="ltr">
            {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
          </p>
          <a
            href={`https://www.google.com/maps?q=${latitude},${longitude}`}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-primary"
          >
            عرض الموقع على الخريطة
          </a>
        </div>
      )}
    </div>
  );
}
