/** Application routes. ProtectedRoute gates the shell; guests go to /login. */
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { Users, FolderKanban, CheckSquare, UserRound, Wallet, Boxes, FileText, BarChart3, Sparkles, Settings } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { DesignSystemPage } from "@/pages/design/DesignSystemPage";
import { useAuthStore } from "@/stores/auth";
import { EmptyState } from "@/components/ui/empty-state";

function ProtectedRoute() {
  const authed = useAuthStore((s) => s.isAuthenticated());
  return authed ? <Outlet /> : <Navigate to="/login" replace />;
}

/** Placeholder pages demo the empty-state pattern until each module ships. */
function ModulePlaceholder({
  title, icon, description, action,
}: { title: string; icon: React.ComponentType<{ className?: string }>; description: string; action: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <EmptyState
        icon={icon}
        title={`No ${title.toLowerCase()} yet`}
        description={description}
        actionLabel={action}
        onAction={() => toast.info(`${title} ships in an upcoming part.`)}
      />
    </div>
  );
}

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [{ path: "/login", element: <LoginPage /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/design", element: <DesignSystemPage /> },
          { path: "/crm", element: <ModulePlaceholder title="CRM" icon={Users} description="Track companies, contacts, leads, and deals in one connected pipeline." action="Create customer" /> },
          { path: "/projects", element: <ModulePlaceholder title="Projects" icon={FolderKanban} description="Plan work with boards, lists, timelines, and calendars." action="Create project" /> },
          { path: "/tasks", element: <ModulePlaceholder title="Tasks" icon={CheckSquare} description="Everything assigned to you and your team, in one place." action="Create task" /> },
          { path: "/hr", element: <ModulePlaceholder title="HR" icon={UserRound} description="Employee profiles, attendance, leave, and performance." action="Add employee" /> },
          { path: "/finance", element: <ModulePlaceholder title="Finance" icon={Wallet} description="Revenue, expenses, invoices, and payments — all visual." action="Create invoice" /> },
          { path: "/inventory", element: <ModulePlaceholder title="Inventory" icon={Boxes} description="Products, warehouses, purchase orders, and stock movements." action="Add product" /> },
          { path: "/documents", element: <ModulePlaceholder title="Documents" icon={FileText} description="Store, organize, and share every business document." action="Upload document" /> },
          { path: "/reports", element: <ModulePlaceholder title="Reports" icon={BarChart3} description="Export, schedule, and share reports across every module." action="Create report" /> },
          { path: "/assistant", element: <ModulePlaceholder title="AI Assistant" icon={Sparkles} description="Ask questions about your business in plain language." action="Start a conversation" /> },
          { path: "/settings", element: <ModulePlaceholder title="Settings" icon={Settings} description="Company profile, members, roles, and preferences." action="Open settings" /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
