import React, { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Search,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
} from "lucide-react";

export type DataTableColumn<T> = {
  header: string;
  accessorKey?: keyof T | string;
  cell?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  sortKey?: string;
  className?: string;
};

export type DataTableProps<T> = {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  onPageChange: (newPage: number) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  searchPlaceholder?: string;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSortChange?: (key: string, direction: "asc" | "desc") => void;
  isLoading?: boolean;
  error?: string | null;
  columns: DataTableColumn<T>[];
  emptyMessage?: string;
  rowKey?: (item: T, index: number) => string | number;
};

export function DataTable<T extends Record<string, any>>({
  data,
  total,
  page,
  perPage,
  onPageChange,
  searchQuery = "",
  onSearchChange,
  searchPlaceholder = "بحث...",
  sortKey,
  sortDirection = "desc",
  onSortChange,
  isLoading = false,
  error = null,
  columns,
  emptyMessage = "لا توجد نتائج مطابقة للبحث",
  rowKey = (item, idx) => item["id"] ?? item["slug"] ?? item["key"] ?? idx,
}: DataTableProps<T>) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!onSearchChange) return;
    const t = setTimeout(() => {
      if (localSearch !== searchQuery) {
        onSearchChange(localSearch);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [localSearch, onSearchChange, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const handleHeaderClick = (col: DataTableColumn<T>) => {
    if (!col.sortable || !onSortChange) return;
    const key = col.sortKey ?? String(col.accessorKey ?? "");
    if (!key) return;

    if (sortKey === key) {
      onSortChange(key, sortDirection === "asc" ? "desc" : "asc");
    } else {
      onSortChange(key, "desc");
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {onSearchChange && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-2xl border border-border bg-background pr-10 pl-4 py-2.5 text-xs text-foreground shadow-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="text-xs text-muted-foreground font-medium">
            إجمالي النتائج: <span className="font-bold text-foreground tabular-nums">{total}</span>
          </div>
        </div>
      )}

      {error ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-xs font-bold text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
                <tr>
                  {columns.map((col, i) => {
                    const isColSortable = col.sortable && onSortChange;
                    const thisKey = col.sortKey ?? String(col.accessorKey ?? "");
                    const isSorted = sortKey === thisKey;

                    return (
                      <th
                        key={i}
                        onClick={() => isColSortable && handleHeaderClick(col)}
                        className={`px-4 py-3.5 ${isColSortable ? "cursor-pointer select-none hover:text-foreground" : ""} ${col.className ?? ""}`}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <span>{col.header}</span>
                          {isColSortable && (
                            <span className="text-muted-foreground">
                              {isSorted ? (
                                sortDirection === "asc" ? (
                                  <ArrowUp className="h-3.5 w-3.5 text-primary" />
                                ) : (
                                  <ArrowDown className="h-3.5 w-3.5 text-primary" />
                                )
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-60" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 bg-background">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="py-14 text-center text-muted-foreground"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span className="font-bold">جاري تحميل البيانات...</span>
                      </div>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="py-14 text-center text-muted-foreground font-medium"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  data.map((row, idx) => (
                    <tr key={rowKey(row, idx)} className="transition-colors hover:bg-muted/20">
                      {columns.map((col, j) => {
                        let content: React.ReactNode = null;
                        if (col.cell) {
                          content = col.cell(row, idx);
                        } else if (col.accessorKey) {
                          content = String(row[col.accessorKey as string] ?? "—");
                        }
                        return (
                          <td
                            key={j}
                            className={`px-4 py-3.5 text-foreground ${col.className ?? ""}`}
                          >
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* شريط ترقيم الصفحات (Pagination Controls) */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-4 py-3 text-xs">
            <div className="text-muted-foreground">
              الصفحة <span className="font-bold text-foreground tabular-nums">{page + 1}</span> من{" "}
              <span className="font-bold text-foreground tabular-nums">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPageChange(Math.max(0, page - 1))}
                disabled={page === 0 || isLoading}
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 font-bold text-foreground transition-colors hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                <span>السابق</span>
              </button>
              <button
                type="button"
                onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1 || isLoading}
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 font-bold text-foreground transition-colors hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none"
              >
                <span>التالي</span>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
