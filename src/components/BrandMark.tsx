import { Link } from "@tanstack/react-router";
import { SmartImage } from "@/components/SmartImage";
import { StoreLogo } from "@/components/StoreLogo";
import { useSettings } from "@/lib/store";

/** Store name colour is configurable from the dashboard; black is the default. */
export function brandColorClass(value?: string | null) {
  if (value === "gold") return "text-primary";
  if (value === "rose") return "text-rose";
  if (value === "gradient") return "text-gradient-gold";
  return "text-foreground";
}

export function BrandMark({
  size = "md",
  asLink = true,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  asLink?: boolean;
  className?: string;
}) {
  const { data: settings } = useSettings();
  const storeName = settings?.store_name ?? "إيهاب ستور للعناية والتجميل";
  const img = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-8 w-8" : "h-10 w-10 sm:h-11 sm:w-11";
  const logoSize = size === "lg" ? "h-7 w-7" : size === "sm" ? "h-4 w-4" : "h-5 w-5 sm:h-6 sm:w-6";
  const text =
    size === "lg" ? "text-lg md:text-xl" : size === "sm" ? "text-xs" : "text-sm md:text-base";

  const inner = (
    <>
      {settings?.logo ? (
        <SmartImage
          paths={[settings.logo]}
          alt={storeName}
          eager
          wrapperClassName={`relative ${img} shrink-0 overflow-hidden rounded-xl flex items-center justify-center bg-transparent`}
          className="h-full w-full object-contain"
        />
      ) : (
        <div
          className={`relative ${img} shrink-0 overflow-hidden rounded-2xl flex items-center justify-center gradient-gold text-primary-foreground shadow-2xs select-none`}
        >
          <StoreLogo className={logoSize} />
        </div>
      )}
      <span
        suppressHydrationWarning
        className={`truncate font-extrabold leading-tight ${text} ${brandColorClass(settings?.brand_text_color)}`}
      >
        {storeName}
      </span>
    </>
  );

  const containerClasses = `inline-flex min-w-0 shrink-0 items-center gap-2 ${className}`;

  if (!asLink) return <div className={containerClasses}>{inner}</div>;
  return (
    <Link to="/" className={containerClasses}>
      {inner}
    </Link>
  );
}
