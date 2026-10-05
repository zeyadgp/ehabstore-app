import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, History, Calendar, Filter } from "lucide-react";
import { fetchAdminAuditLogs, ACTION_LABELS, type AuditLogRow } from "@/lib/admin/audit.functions";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "سجل العمليات الإدارية | لوحة التحكم" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAuditPage,
});

function AdminAuditPage() {
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(50);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [daysFilter, setDaysFilter] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit-logs", { page, perPage, actionFilter, search, daysFilter }],
    queryFn: () =>
      fetchAdminAuditLogs({
        data: {
          page,
          perPage,
          action: actionFilter,
          search,
          days: daysFilter,
        },
      }),
    staleTime: 15_000,
  });

  const columns: DataTableColumn<AuditLogRow>[] = [
    {
      header: "وقت الإجراء",
      accessorKey: "created_at",
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="font-bold text-foreground">
            {new Date(row.created_at).toLocaleDateString("ar-EG")}
          </p>
          <p className="text-[11px] text-muted-foreground" dir="ltr">
            {new Date(row.created_at).toLocaleTimeString("ar-EG")}
          </p>
        </div>
      ),
    },
    {
      header: "نوع العملية",
      accessorKey: "action",
      cell: (row) => {
        const arabicLabel = ACTION_LABELS[row.action] ?? row.action;
        return (
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{arabicLabel}</span>
          </div>
        );
      },
    },
    {
      header: "المنفذ",
      accessorKey: "actor_email",
      cell: (row) => (
        <span className="font-mono text-xs text-foreground" dir="ltr">
          {row.actor_email || row.actor_id?.slice(0, 8) || "النظام"}
        </span>
      ),
    },
    {
      header: "الهدف والجدول",
      accessorKey: "target_table",
      cell: (row) => (
        <div className="text-xs">
          <span className="font-bold text-foreground">{row.target_table || "—"}</span>
          {row.target_id && (
            <span className="block font-mono text-[10px] text-muted-foreground" dir="ltr">
              #{row.target_id.slice(0, 8)}
            </span>
          )}
        </div>
      ),
    },
    {
      header: "التفاصيل المختصرة",
      accessorKey: "details",
      cell: (row) => {
        if (!row.details || Object.keys(row.details).length === 0) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <code className="block max-w-xs truncate rounded-lg bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
            {JSON.stringify(row.details)}
          </code>
        );
      },
    },
    {
      header: "عنوان IP",
      accessorKey: "ip",
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
          {row.ip || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold text-foreground md:text-3xl">
              سجل العمليات الإدارية
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              سجل تدقيق شامل ومؤرّخ لجميع الإجراءات والتغييرات الإدارية الحساسة لضمان الأمان
              والشفافية.
            </p>
          </div>
        </div>
      </div>

      {/* شريط الفلاتر */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="font-bold text-foreground">نوع الإجراء:</span>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(0);
            }}
            className="rounded-lg border-0 bg-transparent text-xs font-medium text-foreground focus:ring-0"
          >
            <option value="all">كافة الإجراءات</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-bold text-foreground">المدى الزمني:</span>
          <select
            value={daysFilter}
            onChange={(e) => {
              setDaysFilter(Number(e.target.value));
              setPage(0);
            }}
            className="rounded-lg border-0 bg-transparent text-xs font-medium text-foreground focus:ring-0"
          >
            <option value={7}>آخر 7 أيام</option>
            <option value={30}>آخر 30 يوماً</option>
            <option value={90}>آخر 3 أشهر</option>
          </select>
        </div>
      </div>

      {/* جدول البيانات */}
      <DataTable<AuditLogRow>
        data={data?.rows ?? []}
        total={data?.total ?? 0}
        page={page}
        perPage={perPage}
        onPageChange={setPage}
        searchQuery={search}
        onSearchChange={(q) => {
          setSearch(q);
          setPage(0);
        }}
        searchPlaceholder="بحث بالإجراء أو البريد أو المعرف..."
        isLoading={isLoading}
        columns={columns}
        emptyMessage="لا توجد عمليات مسجلة مطابقة لمعايير البحث المحددة"
      />
    </div>
  );
}
