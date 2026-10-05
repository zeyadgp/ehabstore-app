import { useQuery } from "@tanstack/react-query";
import { fetchAdminOrdersPage } from "@/lib/admin/orders.functions";

export type AdminOrdersQueryOptions = {
  page?: number;
  perPage?: number;
  search?: string;
  status?: string;
  paymentStatus?: string;
  dateFilter?: string;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
};

export function useAdminOrders(options: AdminOrdersQueryOptions = {}) {
  const {
    page = 0,
    perPage = 50,
    search = "",
    status = "all",
    paymentStatus = "all",
    dateFilter = "all",
    sortKey = "created_at",
    sortDirection = "desc",
  } = options;

  return useQuery({
    queryKey: [
      "admin",
      "orders-page",
      { page, perPage, search, status, paymentStatus, dateFilter, sortKey, sortDirection },
    ],
    queryFn: () =>
      fetchAdminOrdersPage({
        data: {
          page,
          perPage,
          search,
          status,
          paymentStatus,
          dateFilter,
          sortKey,
          sortDirection,
        },
      }),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });
}
