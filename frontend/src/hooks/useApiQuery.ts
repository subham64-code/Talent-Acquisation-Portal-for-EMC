import { useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { hrApi } from "../lib/api";

/**
 * Thin wrapper around TanStack Query tuned for the HR portal:
 * - staleTime keeps data warm so navigating between pages is instant
 * - refetchOnWindowFocus refreshes data when the user comes back to the tab
 * - placeholderData avoids blank screens while a filter changes
 */
export function useApiQuery<T>(
  key: readonly unknown[],
  fetcher: () => Promise<any>,
  options?: Partial<UseQueryOptions<T>>,
) {
  return useQuery<T>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetcher();
      return (res?.data ?? res) as T;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev as any,
    ...options,
  });
}

export const queryKeys = {
  dashboardOverview: ["dashboard", "overview"] as const,
  dashboardDepartments: ["dashboard", "departments"] as const,
  openings: (params: any) => ["openings", params] as const,
  applications: (params: any) => ["applications", params] as const,
  employees: (params: any) => ["employees", params] as const,
  candidates: (params: any) => ["candidates", params] as const,
  departments: (params: any) => ["departments", params] as const,
  interviews: (params: any) => ["interviews", params] as const,
  offers: (params: any) => ["offers", params] as const,
  users: (params: any) => ["users", params] as const,
  notifications: (params: any) => ["notifications", params] as const,
  aiRanked: (jobId: string, params: any) => ["ai", "ranked", jobId, params] as const,
};

/** Invalidates the given query key prefixes after a mutation. */
export function useInvalidate() {
  const qc = useQueryClient();
  return (prefixes: string[]) => {
    for (const prefix of prefixes) {
      qc.invalidateQueries({ queryKey: [prefix] });
    }
  };
}

export { hrApi };
