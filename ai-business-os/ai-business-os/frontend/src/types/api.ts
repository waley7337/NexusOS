/**
 * API contract types — mirror the backend envelope exactly.
 * Every response in the system is an ApiResponse<T>.
 */
export interface ApiError {
  code: string;
  field?: string;
  detail?: string;
  /** Domain reason from backend AppError.details (e.g. subscription_past_due). */
  reason?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  errors: ApiError[] | null;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
}
