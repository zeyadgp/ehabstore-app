import { Skeleton } from "@/components/ui/skeleton";

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-3 shadow-soft space-y-3">
      <Skeleton className="aspect-square w-full rounded-xl bg-secondary/80" />
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-3/4 rounded-md bg-secondary/80" />
        <Skeleton className="h-3 w-1/2 rounded-md bg-secondary/80" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-5 w-1/3 rounded-md bg-secondary/80" />
        <Skeleton className="h-9 w-9 rounded-xl bg-secondary/80" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({
  count = 8,
  columns = 2,
}: {
  count?: number;
  columns?: number;
}) {
  const cols = columns === 3 ? "grid-cols-3 lg:grid-cols-5" : "grid-cols-2 lg:grid-cols-4";
  const gap = columns === 3 ? "gap-2.5 sm:gap-4" : "gap-4";
  return (
    <div className={`grid ${cols} ${gap} mt-6`}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
