/** Application route table — lazy-loaded pages behind guards and error boundaries. */
import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { ROUTES } from "@/constants/routes";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { PermissionRoute } from "@/routes/PermissionRoute";
import { HrPermissionRoute } from "@/routes/HrPermissionRoute";
import { RouteErrorBoundary } from "@/components/route-error-boundary";
import { PageLoading } from "@/components/page-loading";

const LoginPage = lazy(() =>
  import("@/pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import("@/pages/auth/RegisterPage").then((m) => ({ default: m.RegisterPage })),
);
const ForgotPasswordPage = lazy(() =>
  import("@/pages/auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import("@/pages/auth/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })),
);
const VerifyEmailPage = lazy(() =>
  import("@/pages/auth/VerifyEmailPage").then((m) => ({ default: m.VerifyEmailPage })),
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

const CustomersPage = lazy(() =>
  import("@/pages/crm/CustomersPage").then((m) => ({ default: m.CustomersPage })),
);
const ContactsPage = lazy(() =>
  import("@/pages/crm/ContactsPage").then((m) => ({ default: m.ContactsPage })),
);
const LeadsPage = lazy(() =>
  import("@/pages/crm/LeadsPage").then((m) => ({ default: m.LeadsPage })),
);
const DealsPage = lazy(() =>
  import("@/pages/crm/DealsPage").then((m) => ({ default: m.DealsPage })),
);
const EmployeesPage = lazy(() =>
  import("@/pages/hr/EmployeesPage").then((m) => ({ default: m.EmployeesPage })),
);
const EmployeeDetailPage = lazy(() =>
  import("@/pages/hr/EmployeeDetailPage").then((m) => ({ default: m.EmployeeDetailPage })),
);
const ProjectsPage = lazy(() =>
  import("@/pages/projects").then((m) => ({ default: m.ProjectsPage })),
);
const TasksPage = lazy(() =>
  import("@/pages/tasks").then((m) => ({ default: m.TasksPage })),
);
const InvoicesPage = lazy(() => import("@/features/finance").then((m) => ({ default: m.InvoicesPage })));
const InvoiceDetailPage = lazy(() => import("@/features/finance").then((m) => ({ default: m.InvoiceDetailPage })));
const InventoryPage = lazy(() =>
  import("@/pages/inventory").then((m) => ({ default: m.InventoryPage })),
);
const ReportsPage = lazy(() =>
  import("@/pages/reports").then((m) => ({ default: m.ReportsPage })),
);
const AssistantPage = lazy(() =>
  import("@/pages/assistant").then((m) => ({ default: m.AssistantPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/settings").then((m) => ({ default: m.SettingsPage })),
);
const DocumentsPlaceholder = lazy(() =>
  import("@/pages/placeholders/ModulePlaceholders").then((m) => ({ default: m.DocumentsPlaceholder })),
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
      {
        path: ROUTES.register,
        element: (
          <AuthRoute>
            <RegisterPage />
          </AuthRoute>
        ),
      },
      {
        path: ROUTES.forgotPassword,
        element: (
          <AuthRoute>
            <ForgotPasswordPage />
          </AuthRoute>
        ),
      },
      {
        path: ROUTES.resetPassword,
        element: (
          <AuthRoute>
            <ResetPasswordPage />
          </AuthRoute>
        ),
      },
      {
        path: ROUTES.verifyEmail,
        element: (
          <AuthRoute>
            <VerifyEmailPage />
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
          // CRM sibling leaf routes (d5f54d6 semantics) — no nested index redirect.
          {
            element: <PermissionRoute permission="customers.read" />,
            children: [
              { path: ROUTES.crm, element: <CustomersPage /> },
              { path: ROUTES.crmCustomers, element: <CustomersPage /> },
            ],
          },
          {
            element: <PermissionRoute permission="contacts.read" />,
            children: [{ path: ROUTES.crmContacts, element: <ContactsPage /> }],
          },
          {
            element: <PermissionRoute permission="leads.read" />,
            children: [{ path: ROUTES.crmLeads, element: <LeadsPage /> }],
          },
          {
            element: <PermissionRoute permission="deals.read" />,
            children: [{ path: ROUTES.crmDeals, element: <DealsPage /> }],
          },
          { path: ROUTES.projects, element: <ProjectsPage /> },
          { path: ROUTES.tasks, element: <TasksPage /> },
          {
            element: <HrPermissionRoute />,
            children: [
              { path: ROUTES.hr, element: <EmployeesPage /> },
              { path: ROUTES.hrEmployees, element: <EmployeesPage /> },
              { path: ROUTES.hrEmployeeDetail, element: <EmployeeDetailPage /> },
            ],
          },
          {
            element: <PermissionRoute permission="invoices.read" />,
            children: [
              { path: ROUTES.finance, element: <InvoicesPage /> },
              { path: ROUTES.financeInvoices, element: <InvoicesPage /> },
              { path: ROUTES.financeInvoiceDetail, element: <InvoiceDetailPage /> },
            ],
          },
          { path: ROUTES.inventory, element: <InventoryPage /> },
          { path: ROUTES.documents, element: <DocumentsPlaceholder /> },
          { path: ROUTES.reports, element: <ReportsPage /> },
          { path: ROUTES.assistant, element: <AssistantPage /> },
          {
            element: <PermissionRoute permission="settings.view" />,
            children: [{ path: ROUTES.settings, element: <SettingsPage /> }],
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
