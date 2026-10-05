import { Heart } from "lucide-react";

/** Read-only hearts row used in product cards, compare, and the reviews list. */
export function Stars({ value, size = "sm" }: { value: number; size?: "xs" | "sm" | "md" }) {
  const cls = size === "xs" ? "h-3.5 w-3.5" : size === "md" ? "h-5 w-5" : "h-4 w-4";
  const rounded = Math.round(Math.max(0, Math.min(5, value)));
  return (
    <div className="flex items-center gap-0.5 text-primary" aria-label={`تقييم ${value} من 5 قلوب`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Heart
          key={i}
          className={`${cls} transition-colors ${
            i < rounded ? "fill-primary text-primary drop-shadow-xs" : "text-muted-foreground/25"
          }`}
        />
      ))}
    </div>
  );
}

export const Hearts = Stars;
