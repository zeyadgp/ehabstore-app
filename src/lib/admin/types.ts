export type PaginatedResult<T> = {
  rows: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};
