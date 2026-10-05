import { forwardRef } from "react";

export interface StoreLogoProps extends React.HTMLAttributes<HTMLElement> {
  className?: string;
  variant?: "mask" | "image";
  color?: "current" | "primary" | "rose" | "gold" | "white" | "muted" | "foreground";
  alt?: string;
}

/**
 * StoreLogo renders the official luxury brand mark of Ehab Store ("إيهاب ستور").
 * Pure vector SVG luxury gem emblem.
 */
export const StoreLogo = forwardRef<HTMLElement, StoreLogoProps>(function StoreLogo(
  { className = "h-4 w-4", color = "current", alt = "شعار إيهاب ستور الرسمي", style, ...rest },
  ref,
) {
  let colorClass = "text-current";
  if (color === "primary") colorClass = "text-primary";
  else if (color === "rose") colorClass = "text-rose";
  else if (color === "gold") colorClass = "text-amber-500";
  else if (color === "white") colorClass = "text-white";
  else if (color === "muted") colorClass = "text-muted-foreground";
  else if (color === "foreground") colorClass = "text-foreground";

  return (
    <span
      ref={ref as React.Ref<HTMLSpanElement>}
      role="img"
      aria-label={alt}
      className={`inline-flex shrink-0 items-center justify-center align-middle ${colorClass} ${className}`}
      style={style}
      {...rest}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-full w-full object-contain"
      >
        <polygon points="6 3 18 3 22 9 12 21 2 9 6 3" fill="currentColor" fillOpacity="0.18" />
        <polyline points="2 9 12 21 22 9" />
        <polyline points="6 3 12 9 18 3" />
        <line x1="2" y1="9" x2="22" y2="9" />
        <line x1="12" y1="9" x2="12" y2="21" />
      </svg>
    </span>
  );
});

export default StoreLogo;
