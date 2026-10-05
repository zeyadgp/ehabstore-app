import { Link } from "@tanstack/react-router";
import { ArrowLeft, Camera, ShoppingBag } from "lucide-react";
import splitModelImg from "@/assets/studio-model-split.jpg";
import defaultModelImg from "@/assets/studio-default-model.jpg";
import { useStudioSettings } from "@/lib/studio-settings";

export function StudioPromoCard() {
  const { data: studioSettings } = useStudioSettings();

  if (studioSettings?.hidePromoCard || studioSettings?.disabled) {
    return null;
  }

  return (
    <article className="relative overflow-hidden rounded-[2.2rem] sm:rounded-[2.8rem] border border-[#f8d4dc] bg-gradient-to-br from-[#fff7f8] via-[#fdf1f4] to-[#fcecee] p-6 sm:p-8 lg:p-11 shadow-[0_15px_40px_-10px_rgba(219,76,120,0.12)]">
      {/* Decorative Crushed Powder Accents in Corners */}
      <div
        className="pointer-events-none absolute -top-8 -right-8 h-48 w-48 sm:h-64 sm:w-64 opacity-50 blur-xs"
        aria-hidden="true"
      >
        <svg viewBox="0 0 200 200" className="h-full w-full">
          <path
            d="M 120,10 C 170,20 190,60 185,110 C 180,160 140,180 100,165 C 60,150 40,120 45,70 C 50,20 80,0 120,10 Z"
            fill="url(#powderGrad1)"
          />
          <circle cx="155" cy="50" r="14" fill="#df6b88" opacity="0.6" />
          <circle cx="175" cy="85" r="9" fill="#c44e6b" opacity="0.5" />
          <circle cx="130" cy="140" r="12" fill="#e8819d" opacity="0.5" />
          <defs>
            <radialGradient id="powderGrad1" cx="60%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#df6b88" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#c44e6b" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f7cad5" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      <div
        className="pointer-events-none absolute -bottom-10 -right-4 h-40 w-40 sm:h-52 sm:w-52 opacity-40 blur-xs"
        aria-hidden="true"
      >
        <svg viewBox="0 0 150 150" className="h-full w-full">
          <path
            d="M 80,20 C 130,10 145,50 140,100 C 135,140 90,145 50,130 C 20,115 10,80 25,45 C 40,10 50,25 80,20 Z"
            fill="url(#powderGrad2)"
          />
          <circle cx="110" cy="110" r="10" fill="#c44e6b" opacity="0.4" />
          <circle cx="60" cy="120" r="7" fill="#df6b88" opacity="0.4" />
          <defs>
            <radialGradient id="powderGrad2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#c44e6b" stopOpacity="0.4" />
              <stop offset="70%" stopColor="#e8819d" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#fcecee" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        {/* Left Column: Text, Feature Badges, and CTA Button */}
        <div className="flex flex-col items-start text-right">
          {/* Top Badge with decorative playful rays */}
          <div className="relative inline-block">
            {/* 3 playful decorative pink rays */}
            <div className="pointer-events-none absolute -top-4 start-10 flex items-end justify-center gap-1 opacity-80">
              <span className="h-2.5 w-0.5 -rotate-25 rounded-full bg-[#df6b88]" />
              <span className="h-3.5 w-0.5 rounded-full bg-[#df6b88]" />
              <span className="h-2.5 w-0.5 rotate-25 rounded-full bg-[#df6b88]" />
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-[#f7b9c9] bg-[#fde7ed] px-4 py-1.5 text-xs sm:text-sm font-extrabold text-[#c2456e] shadow-2xs">
              <span className="text-xs">✦</span>
              <span>تجربة افتراضية مباشرة</span>
              <span className="text-xs">✂</span>
            </div>
          </div>

          {/* Headline */}
          <h2 className="mt-4 font-display text-2xl sm:text-3xl lg:text-[2.35rem] font-black leading-tight tracking-tight text-[#3b1822]">
            جرّبي المكياج قبل الشراء
          </h2>

          {/* Subtitle */}
          <p className="mt-3 max-w-md text-sm sm:text-base font-medium leading-relaxed text-[#6b4b56]">
            اختاري الدرجة المناسبة على صورتك، وشاهدي النتيجة في الوقت الحقيقي.
          </p>

          {/* Feature Badges Row */}
          <div className="mt-5 flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm font-extrabold text-[#3b1822]">
            <div className="inline-flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#c2456e]/40 text-[#c2456e]">
                <Camera className="h-4 w-4 stroke-[2.2]" />
              </span>
              <span>صورة أو كاميرا</span>
            </div>

            <div className="inline-flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#c2456e]/40 text-[#c2456e]">
                <ShoppingBag className="h-4 w-4 stroke-[2.2]" />
              </span>
              <span>مرتبط بمنتجات المتجر</span>
            </div>
          </div>

          {/* Big CTA Button */}
          <div className="mt-7 w-full sm:w-auto">
            <Link
              to="/studio"
              className="group inline-flex w-full sm:w-auto items-center justify-between gap-5 rounded-2xl sm:rounded-full bg-gradient-to-r from-[#b8335e] via-[#c2456e] to-[#cc4973] px-7 py-3.5 sm:py-4 text-white shadow-xl shadow-[#c2456e]/30 transition-all duration-300 hover:brightness-105 hover:shadow-2xl hover:shadow-[#c2456e]/45 active:scale-[0.98]"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.5] transition-transform group-hover:-translate-x-1" />
              <span className="text-base sm:text-lg font-black tracking-wide">
                ابدئي التجربة الآن
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 shadow-inner">
                <Camera className="h-5 w-5 stroke-[2.2] text-white" />
              </span>
            </Link>
          </div>
        </div>

        {/* Right Column: Mirror Frame with Before/After split and makeup accents */}
        <div className="relative mx-auto flex items-center justify-center py-2">
          {/* Main Mirror / Smartphone Frame */}
          <div className="relative aspect-[3/4] w-64 sm:w-72 lg:w-[19.5rem] overflow-hidden rounded-[2.2rem] border-[6px] border-white bg-card shadow-[0_20px_50px_-10px_rgba(219,76,120,0.28)]">
            {/* Split Photo */}
            <img
              src={splitModelImg || defaultModelImg}
              alt="تجربة المكياج الافتراضية قبل وبعد"
              className="h-full w-full object-cover object-center"
              onError={(e) => {
                if (defaultModelImg && e.currentTarget.src !== defaultModelImg) {
                  e.currentTarget.src = defaultModelImg;
                }
              }}
            />

            {/* Vertical Dividing Hairline */}
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.9)]" />

            {/* 4 Viewfinder Corner Brackets */}
            <div className="pointer-events-none absolute inset-3.5">
              <span className="absolute top-0 left-0 h-6 w-6 rounded-tl-md border-t-2 border-l-2 border-white/95 drop-shadow-sm" />
              <span className="absolute top-0 right-0 h-6 w-6 rounded-tr-md border-t-2 border-r-2 border-white/95 drop-shadow-sm" />
              <span className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-md border-b-2 border-l-2 border-white/95 drop-shadow-sm" />
              <span className="absolute bottom-0 right-0 h-6 w-6 rounded-br-md border-b-2 border-r-2 border-white/95 drop-shadow-sm" />
            </div>

            {/* Badges inside mirror at bottom: قبل on the left, بعد on the right */}
            <div className="pointer-events-none absolute bottom-4 inset-x-4 z-10 flex items-center justify-between">
              <span className="rounded-full bg-white/85 px-4 py-1 text-xs font-black text-[#4a222f] shadow-md backdrop-blur-md">
                قبل
              </span>
              <span className="rounded-full bg-[#e84c79] px-4 py-1 text-xs font-black text-white shadow-md">
                بعد
              </span>
            </div>
          </div>

          {/* Overlapping Cosmetic Blush Brush at Bottom-Left */}
          <div
            className="pointer-events-none absolute -bottom-5 -left-4 sm:-bottom-6 sm:-left-6 z-20 w-16 sm:w-20 drop-shadow-xl"
            aria-hidden="true"
          >
            <svg viewBox="0 0 100 200" className="h-full w-full rotate-[15deg]">
              {/* Handle */}
              <path
                d="M 42,95 L 38,190 C 38,195 62,195 62,190 L 58,95 Z"
                fill="url(#brushHandle)"
              />
              {/* Ferrule */}
              <rect x="41" y="65" width="18" height="30" rx="3" fill="url(#brushFerrule)" />
              {/* Bristles Dome with blush tip */}
              <path
                d="M 41,65 C 30,50 30,20 50,5 C 70,20 70,50 59,65 Z"
                fill="url(#brushBristles)"
              />
              <defs>
                <linearGradient id="brushHandle" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#e3af99" />
                  <stop offset="50%" stopColor="#ffd8c8" />
                  <stop offset="100%" stopColor="#c59078" />
                </linearGradient>
                <linearGradient id="brushFerrule" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#d19c72" />
                  <stop offset="40%" stopColor="#ffe2c4" />
                  <stop offset="100%" stopColor="#a36e44" />
                </linearGradient>
                <linearGradient id="brushBristles" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#4a2c21" />
                  <stop offset="45%" stopColor="#7a4b39" />
                  <stop offset="75%" stopColor="#c75270" />
                  <stop offset="100%" stopColor="#e87391" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Overlapping Lipstick Tube at Right */}
          <div
            className="pointer-events-none absolute -right-3 sm:-right-5 top-1/4 z-20 w-11 sm:w-13 drop-shadow-xl"
            aria-hidden="true"
          >
            <svg viewBox="0 0 80 180" className="h-full w-full rotate-[-12deg]">
              {/* Base casing */}
              <rect x="22" y="95" width="36" height="80" rx="4" fill="url(#lipstickBase)" />
              <rect x="24" y="90" width="32" height="6" fill="#f0ca9b" />
              {/* Gold Inner Barrel */}
              <rect x="27" y="55" width="26" height="35" rx="2" fill="url(#lipstickGold)" />
              {/* Slanted Lipstick Bullet */}
              <path d="M 29,55 L 29,30 C 29,12 50,5 51,20 L 51,55 Z" fill="url(#lipstickBullet)" />
              <defs>
                <linearGradient id="lipstickBase" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1a1a1a" />
                  <stop offset="50%" stopColor="#3d3d3d" />
                  <stop offset="100%" stopColor="#111111" />
                </linearGradient>
                <linearGradient id="lipstickGold" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#c89658" />
                  <stop offset="40%" stopColor="#ffe0a8" />
                  <stop offset="100%" stopColor="#96682e" />
                </linearGradient>
                <linearGradient id="lipstickBullet" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f2557d" />
                  <stop offset="50%" stopColor="#d83a62" />
                  <stop offset="100%" stopColor="#a31d40" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>
    </article>
  );
}
