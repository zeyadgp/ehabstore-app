import { useEffect, useState } from "react";
import { Apple, Share } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/lib/store";
import { SmartImage } from "@/components/SmartImage";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** أيقونة متجر Google Play (SVG بسيط بلون العلامة). */
function PlayIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3.6 1.9c-.4.3-.6.8-.6 1.5v17.2c0 .7.2 1.2.6 1.5l9.2-10.1L3.6 1.9Zm10.4 9.3 2.9-3.2-9.5-5.4c-.5-.3-1-.3-1.3-.1l7.9 8.7Zm0 1.6-7.9 8.7c.3.2.8.2 1.3-.1l9.5-5.4-2.9-3.2Zm4-2.1 2.5 1.4c.9.5.9 1.5 0 2l-2.5 1.4-3.1-3.4 3.1-3.4Z" />
    </svg>
  );
}

/**
 * بطاقة تحميل التطبيق:
 * - زر «تثبيت التطبيق» يفتح نافذة تثبيت PWA عندما يدعمها المتصفح، ويعرض
 *   تعليمات الإضافة للشاشة الرئيسية على iPhone/المتصفحات غير المدعومة.
 * - زر «تحميل التطبيق (APK)» اختياري: يظهر فقط عند تعيين رابط من لوحة التحكم،
 *   ويتحول تلقائياً إلى زر «متجر Google Play» إذا كان الرابط لمتجر بلاي.
 */
export function InstallApp({ className = "" }: { className?: string }) {
  const { data: settings } = useSettings();
  const androidLink =
    (settings as { app_download_url?: string | null } | undefined)?.app_download_url?.trim() ||
    null;
  const iosLink = settings?.ios_app_url?.trim() || null;
  const iosBadge = settings?.ios_badge_image?.trim() || null;
  const androidBadge = settings?.android_badge_image?.trim() || null;
  const isPlayStore = Boolean(androidLink && /play\.google\.com/i.test(androidLink));

  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [hint, setHint] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    // iOS يعتبر التطبيق مثبتاً عبر navigator.standalone
    if ((window.navigator as { standalone?: boolean }).standalone) setInstalled(true);
    setSupported("serviceWorker" in navigator);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // مثبّت بالفعل ولا يوجد رابط تحميل ⇒ لا شيء يُعرض.
  if (installed && !androidLink && !iosLink) return null;

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") {
        setInstalled(true);
        toast.success("تم بدء تثبيت التطبيق على جهازك");
      }
      setDeferred(null);
      return;
    }
    setHint(true);
    if (!supported) {
      toast.info("متصفحك لا يدعم التثبيت المباشر — استخدم «إضافة إلى الشاشة الرئيسية».");
      return;
    }
    toast.info("لتثبيت التطبيق: افتح قائمة المتصفح ثم «إضافة إلى الشاشة الرئيسية».");
  };

  return (
    <div className={className}>
      <div>
        <p className="text-sm font-extrabold">حمّلي التطبيق</p>
        <p className="mt-1 text-[11px] text-muted-foreground">تسوّق أسرع وإشعارات بالعروض</p>

        <div className="mt-3 flex flex-wrap gap-2" dir="ltr">
          <a
            href={iosLink ?? undefined}
            onClick={
              iosLink
                ? undefined
                : (event) => {
                    event.preventDefault();
                    void install();
                  }
            }
            target={iosLink ? "_blank" : undefined}
            rel={iosLink ? "noreferrer" : undefined}
            className="flex min-h-12 min-w-36 flex-1 items-center justify-center gap-2.5 rounded-xl border border-primary/20 gradient-gold px-3.5 py-2 text-primary-foreground shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95 hover:shadow-lift active:scale-95"
            aria-label="التحميل من App Store"
          >
            {iosBadge ? (
              <SmartImage
                paths={[iosBadge]}
                alt="App Store"
                className="h-10 max-w-36 object-contain"
              />
            ) : (
              <>
                <Apple className="h-7 w-7 fill-current" />
                <span className="text-left leading-none">
                  <span className="block text-[9px] font-bold opacity-90">Download on the</span>
                  <span className="mt-1 block text-base font-extrabold">App Store</span>
                </span>
              </>
            )}
          </a>

          <a
            href={androidLink ?? undefined}
            onClick={
              androidLink
                ? undefined
                : (event) => {
                    event.preventDefault();
                    void install();
                  }
            }
            {...(androidLink
              ? isPlayStore
                ? { target: "_blank", rel: "noreferrer" }
                : { download: "", rel: "noopener" }
              : {})}
            className="flex min-h-12 min-w-36 flex-1 items-center justify-center gap-2.5 rounded-xl border border-primary/20 gradient-gold px-3.5 py-2 text-primary-foreground shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95 hover:shadow-lift active:scale-95"
            aria-label={isPlayStore ? "التحميل من Google Play" : "تحميل تطبيق أندرويد"}
          >
            {androidBadge ? (
              <SmartImage
                paths={[androidBadge]}
                alt="Google Play"
                className="h-10 max-w-36 object-contain"
              />
            ) : (
              <>
                <PlayIcon className="h-7 w-7" />
                <span className="text-left leading-none">
                  <span className="block text-[9px] font-bold opacity-90">GET IT ON</span>
                  <span className="mt-1 block text-base font-extrabold">Google Play</span>
                </span>
              </>
            )}
          </a>
        </div>

        {hint && !installed && (
          <p className="mt-3 flex items-start gap-2 rounded-2xl border border-border bg-card p-3 text-xs leading-6 text-muted-foreground">
            <Share className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            على iPhone: زر المشاركة ثم «إضافة إلى الشاشة الرئيسية». على أندرويد: قائمة المتصفح ثم
            «تثبيت التطبيق».
          </p>
        )}
      </div>
    </div>
  );
}
