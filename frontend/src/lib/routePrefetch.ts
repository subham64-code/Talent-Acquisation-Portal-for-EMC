import type { QueryClient } from "@tanstack/react-query";
import { hrApi } from "./api";
import { queryKeys } from "../hooks/useApiQuery";

/**
 * Warms the page chunk (and the data it needs) when the user hovers or focuses
 * a navigation link, so the destination renders instantly on click — even on
 * slow phones and high-latency connections.
 */
const chunks: Record<string, () => Promise<unknown>> = {
  "/hr": () => import("../pages/hr/routes"),
  "/hr/dashboard": () => import("../pages/hr/HrWorkspaceDashboard"),
  "/hr/talent-dashboard": () => import("../pages/hr/Dashboard"),
  "/hr/help": () => import("../pages/hr/Help"),
  "/hr/team": () => import("../pages/hr/Users"),
  "/hr/users": () => import("../pages/hr/Users"),
  "/hr/permissions": () => import("../pages/hr/AccessControl"),
  "/hr/access-control": () => import("../pages/hr/AccessControl"),
  "/hr/approvals": () => import("../pages/hr/Approvals"),
  "/hr/manage-openings": () => import("../pages/hr/Openings"),
  "/hr/openings": () => import("../pages/hr/Openings"),
  "/hr/submissions": () => import("../pages/hr/Submissions"),
  "/hr/shortlisting": () => import("../pages/hr/Shortlisting"),
  "/hr/final-selection": () => import("../pages/hr/FinalSelection"),
  "/hr/ai-screening": () => import("../pages/hr/AIScreening"),
  "/hr/interviews": () => import("../pages/hr/Interviews"),
  "/hr/offers": () => import("../pages/hr/Offers"),
  "/hr/onboarding": () => import("../pages/hr/Onboarding"),
  "/hr/employees": () => import("../pages/hr/Employees"),
  "/hr/reports": () => import("../pages/hr/Reports"),
  "/hr/notifications": () => import("../pages/hr/Notifications"),
  "/hr/settings": () => import("../pages/hr/Settings"),
};

const prefetched = new Set<string>();

const dataPrefetchers: Record<string, (queryClient: QueryClient) => void> = {
  "/hr/manage-openings": (queryClient) => {
    const params = { page: 1, pageSize: 100, search: undefined };
    void queryClient.prefetchQuery({
      queryKey: queryKeys.openings(params),
      queryFn: () => hrApi.openings(params).then((r: any) => r?.data?.items ?? []),
    });
    void queryClient.prefetchQuery({
      queryKey: ["employment-types", "dropdown"],
      queryFn: () => hrApi.employmentTypes().then((r: any) => r?.data?.items ?? r?.data ?? []),
    });
  },
};

export function prefetchRoute(to: string, queryClient?: QueryClient) {
  const path = to.split("?")[0];
  const load = chunks[path];
  if (load && !prefetched.has(path)) {
    prefetched.add(path);
    load().catch(() => prefetched.delete(path));
  }
  if (queryClient) dataPrefetchers[path]?.(queryClient);
}
