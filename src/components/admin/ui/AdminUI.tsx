import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Consistent page title row for every admin screen. */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {Icon && <Icon className="h-5 w-5 shrink-0 text-primary" />}
        <div className="min-w-0">
          <h1 className="truncate text-base font-extrabold sm:text-lg">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Compact KPI card that stays readable on small phones. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "primary" | "warning" | "danger";
}) {
  const tones: Record<string, string> = {
    default: "bg-card",
    primary: "bg-primary/10 border-primary/30",
    warning: "bg-accent/40",
    danger: "bg-destructive/10 border-destructive/30",
  };
  return (
    <div className={`rounded-2xl border border-border p-3 shadow-soft ${tones[tone]}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        <span className="truncate text-[11px] font-bold text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1 truncate text-lg font-extrabold tabular-nums">{value}</p>
      {hint && <p className="truncate text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Friendly empty state instead of a blank list. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-center">
      {Icon && <Icon className="h-7 w-7 text-muted-foreground/60" />}
      <p className="text-sm font-bold">{title}</p>
      {hint && <p className="max-w-xs text-[11px] text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}

/** Simple skeleton rows while data loads. */
export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}

/** Horizontally scrollable toolbar so filters never break the mobile layout. */
export function ScrollRow({ children }: { children: ReactNode }) {
  return <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">{children}</div>;
}

/** Collapsible section — keeps long forms out of the way on phones. */
export function CollapsibleCard({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold">
        {title}
        <span className="text-xs text-muted-foreground transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export const adminInput =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs outline-none focus:border-primary";
export const adminBtn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold";
