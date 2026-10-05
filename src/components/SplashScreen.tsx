import { useEffect, useState } from "react";

const KEY = "ehab-splash-shown";

/**
 * شاشة بداية ترحيبية شفافة لمدة 3 ثوانٍ، تظهر مرة واحدة في كل جلسة تصفح
 * ولا تعطّل التفاعل بعد انتهائها.
 */
export function SplashScreen() {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const first = !sessionStorage.getItem(KEY);
    if (first) sessionStorage.setItem(KEY, "1");
    if (first) setShow(true);
    // المؤقتات تُضبط دائماً حتى لو أُعيد تشغيل التأثير (StrictMode)
    // وإلا تبقى الشاشة معلقة ولا تختفي أبداً.
    const fade = setTimeout(() => setFading(true), 700);
    const hide = setTimeout(() => setShow(false), 1100);
    return () => {
      clearTimeout(fade);
      clearTimeout(hide);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-300 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="animate-scale-in text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[32px] gradient-gold text-3xl font-extrabold text-primary-foreground shadow-lift">
          إ
        </div>
        <h1 className="animate-fade-in mt-6 text-2xl font-extrabold text-foreground">إيهاب ستور</h1>
        <p className="animate-fade-in mt-2 text-sm text-muted-foreground">
          جمالك يبدأ من هنا — منتجات أصلية وتوصيل سريع
        </p>
        <div className="mx-auto mt-6 h-1 w-40 overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-full origin-right gradient-gold animate-[fade-in_2.6s_ease-out]" />
        </div>
      </div>
    </div>
  );
}
