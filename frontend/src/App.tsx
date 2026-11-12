import { lazy, Suspense, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import Logo from "./components/Logo";

// Every route is code-split so the first paint only downloads what is needed.
const HRLogin = lazy(() => import("./pages/hr/Login"));
const EmployeeUpdate = lazy(() => import("./pages/employee/Update"));
const OfferRespond = lazy(() => import("./pages/offer/Respond"));
const OnboardDocuments = lazy(() => import("./pages/public/OnboardDocuments"));
const Home = lazy(() => import("./pages/public/Home"));
const Jobs = lazy(() => import("./pages/public/Jobs"));
const JobDetail = lazy(() => import("./pages/public/JobDetail"));
const Apply = lazy(() => import("./pages/public/Apply"));
const HRRoutes = lazy(() => import("./pages/hr/routes"));
const ITRoutes = lazy(() => import("./pages/it/ITRoutes"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center surface-app">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-[#198754]/20 border-t-[#198754] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm ink-soft">Loading…</p>
      </div>
    </div>
  );
}

function isItAdmin(u: any): boolean {
  const roles = Array.isArray(u?.roles) ? u.roles : [];
  return roles.includes("IT_ADMIN");
}

function RequireHR({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (!user || user.type !== "HR") return <Navigate to="/auth/hr/login" replace />;
  return <>{children}</>;
}

function RequireIT({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (!user || user.type !== "HR") return <Navigate to="/auth/hr/login" replace />;
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const canAdmin = roles.includes("IT_ADMIN") || roles.includes("SUPER_ADMIN");
  if (!canAdmin) return <Navigate to="/hr/dashboard" replace />;
  return <>{children}</>;
}

function PublicHome() {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (user?.type === "HR") return <Navigate to={isItAdmin(user) && !(user?.roles || []).includes("SUPER_ADMIN") ? "/it/dashboard" : "/hr/dashboard"} replace />;
  return <Navigate to="/career" replace />;
}

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 surface-app px-4 text-center">
      <Logo size={56} />
      <h1 className="text-2xl font-extrabold ink-body">Page not found</h1>
      <p className="text-sm ink-soft">The page you are looking for does not exist or has moved.</p>
      <a href="/career" className="btn-primary">Back to careers</a>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<PublicHome />} />
                <Route path="/auth/hr/login" element={<HRLogin />} />
                <Route path="/employee/update" element={<EmployeeUpdate />} />
                <Route path="/offer/respond" element={<OfferRespond />} />
                <Route path="/onboard/documents" element={<OnboardDocuments />} />
                <Route path="/career" element={<Home />} />
                <Route path="/careers/jobs" element={<Jobs />} />
                <Route path="/careers/jobs/:id" element={<JobDetail />} />
                <Route path="/careers/apply" element={<Apply />} />
                <Route path="/hr/*" element={<RequireHR><HRRoutes /></RequireHR>} />
                <Route path="/it/*" element={<RequireIT><ITRoutes /></RequireIT>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
