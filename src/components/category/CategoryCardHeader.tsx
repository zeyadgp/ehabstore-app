import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export type CategoryCardHeaderProps = {
  category: {
    id: string;
    name: string;
    slug: string;
    icon?: string | null;
  };
  subtext?: string | null | undefined;
};

/**
 * رأس بطاقة القسم مع زر نسخ ومشاركة رابط القسم
 */
export function CategoryCardHeader({ category, subtext }: CategoryCardHeaderProps) {
  const onShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const origin =
        typeof window !== "undefined" && window.location.origin
          ? window.location.origin
          : "https://ehabstore.app";
      const shareUrl = `${origin}/products?category=${encodeURIComponent(category.slug)}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("تم نسخ رابط القسم");
    } catch {
      toast.error("تعذر نسخ الرابط. حاول مرة أخرى.");
    }
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        to="/products"
        search={{ category: category.slug }}
        className="min-w-0 flex-1 flex items-center justify-between gap-1.5 transition-colors"
      >
        <div className="min-w-0">
          <h2 className="truncate font-display text-sm font-extrabold text-foreground transition-colors group-hover:text-primary">
            {category.icon ? `${category.icon} ` : ""}
            {category.name}
          </h2>
          {subtext && <p className="truncate text-xs text-muted-foreground">{subtext}</p>}
        </div>
        <ChevronLeft className="h-4 w-4 shrink-0 text-primary transition-transform duration-200 group-hover:-translate-x-1" />
      </Link>
      <button
        type="button"
        role="button"
        aria-label={`مشاركة رابط قسم ${category.name}`}
        onClick={onShare}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/80 text-muted-foreground transition-all duration-150 hover:border-primary/60 hover:bg-secondary hover:text-primary active:scale-95"
        title="مشاركة رابط القسم"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
