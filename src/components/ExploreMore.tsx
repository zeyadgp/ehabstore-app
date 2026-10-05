import { Link } from "@tanstack/react-router";
import { SmartImage } from "@/components/SmartImage";
import { fallbackFor } from "@/lib/images";
import { childrenOf, rootCategories, type Category } from "@/lib/store";

/**
 * «استكشف المزيد» — يظهر بعد نهاية المنتجات فقط.
 * قسم رئيسي → أقسامه الفرعية، قسم فرعي → أشقاؤه، وإلا الأقسام الرئيسية.
 */
export function ExploreMore({
  categories,
  active,
}: {
  categories: Category[];
  active?: Category | undefined;
}) {
  const kids = active ? childrenOf(categories, active.id) : [];
  const siblings = active?.parent_id
    ? childrenOf(categories, active.parent_id).filter((c) => c.id !== active.id)
    : [];
  const roots = rootCategories(categories).filter((c) => c.kind !== "brand" && c.id !== active?.id);
  const list = (kids.length > 0 ? kids : siblings.length > 0 ? siblings : roots).slice(0, 20);
  if (list.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-lg font-extrabold">استكشف المزيد</h2>
      <div className="mt-4 -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {list.map((c) => (
          <Link
            key={c.id}
            to="/products"
            search={{ category: c.slug }}
            className="flex w-[72px] shrink-0 flex-col items-center gap-1.5"
          >
            <span className="h-16 w-16 overflow-hidden rounded-full border border-border">
              <SmartImage
                paths={c.image ? [c.image] : c.cover_image ? [c.cover_image] : []}
                fallback={fallbackFor(c.slug)}
                alt={c.name}
                className="h-full w-full object-cover"
              />
            </span>
            <span className="line-clamp-2 text-center text-[10px] font-bold leading-tight">
              {c.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
