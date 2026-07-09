/** Application route table — lazy-loaded pages behind guards and error boundaries. */
import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { ROUTES } from "@/constants/routes";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { PermissionRoute } from "@/routes/PermissionRoute";
import { RouteErrorBoundary } from "@/components/route-error-boundary";
import { PageLoading } from "@/components/page-loading";

const LoginPage = lazy(() =>
  import("@/pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import("@/pages/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const DesignSystemPage = lazy(() =>
  import("@/pages/design/DesignSystemPage").then((m) => ({ default: m.DesignSystemPage })),
);
const NotFoundPage = lazy(() =>
  import("@/pages/errors/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
);

const CrmPlaceholder = lazy(() =>
  import("@/pages/placeholders/ModulePlaceholders").then((m) => ({ default: m.CrmPlaceholder })),
);
const ProjectsPlaceholder = lazy(() =>
  import("@/pages/placeholders/ModulePlaceholders").then((m) => ({ default: m.ProjectsPlaceholder })),
);
const TasksPlaceholder = lazy(() =>
  import("@/pages/placeholders/ModulePlaceholders").then((m) => ({ default: m.TasksPlaceholder })),
);
const HrPlaceholder = lazy(() =>
  import("@/pages/placeholders/ModulePlaceholders").then((m) => ({ default: m.HrPlaceholder })),
);
const FinancePlaceholder = lazy(() =>
  import("@/pages/placeholders/ModulePlaceholders").then((m) => ({ default: m.FinancePlaceholder })),
);
const InventoryPlaceholder = lazy(() =>
  import("@/pages/placeholders/ModulePlaceholders").then((m) => ({ default: m.InventoryPlaceholder })),
);
const DocumentsPlaceholder = lazy(() =>
  import("@/pages/placeholders/ModulePlaceholders").then((m) => ({ default: m.DocumentsPlaceholder })),
);
const ReportsPlaceholder = lazy(() =>
  import("@/pages/placeholders/ModulePlaceholders").then((m) => ({ default: m.ReportsPlaceholder })),
);
const AssistantPlaceholder = lazy(() =>
  import("@/pages/placeholders/ModulePlaceholders").then((m) => ({ default: m.AssistantPlaceholder })),
);
const SettingsPlaceholder = lazy(() =>
  import("@/pages/placeholders/ModulePlaceholders").then((m) => ({ default: m.SettingsPlaceholder })),
);

function AuthRoute({ children }: { children: React.ReactNode }) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<PageLoading />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      {
        path: ROUTES.login,
        element: (
          <AuthRoute>
            <LoginPage />
          </AuthRoute>
        ),
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: ROUTES.home, element: <DashboardPage /> },
          { path: ROUTES.design, element: <DesignSystemPage /> },
          { path: ROUTES.crm, element: <CrmPlaceholder /> },
          { path: ROUTES.projects, element: <ProjectsPlaceholder /> },
          { path: ROUTES.tasks, element: <TasksPlaceholder /> },
          { path: ROUTES.hr, element: <HrPlaceholder /> },
          {
            element: <PermissionRoute permission="finance.view" />,
            children: [{ path: ROUTES.finance, element: <FinancePlaceholder /> }],
          },
          { path: ROUTES.inventory, element: <InventoryPlaceholder /> },
          { path: ROUTES.documents, element: <DocumentsPlaceholder /> },
          { path: ROUTES.reports, element: <ReportsPlaceholder /> },
          { path: ROUTES.assistant, element: <AssistantPlaceholder /> },
          {
            element: <PermissionRoute permission="settings.view" />,
            children: [{ path: ROUTES.settings, element: <SettingsPlaceholder /> }],
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: (
      <AuthRoute>
        <NotFoundPage />
      </AuthRoute>
    ),
  },
]);
