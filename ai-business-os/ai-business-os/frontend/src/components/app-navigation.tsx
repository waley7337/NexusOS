import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/constants/routes";
import { prefetchRoute } from "@/routes/prefetch";
import { useUiStore } from "@/stores/ui";
import { Drawer, DrawerContent, DrawerHeader } from "@/components/ui/drawer";

interface AppNavigationProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

function NavItems({ collapsed = false, onNavigate }: AppNavigationProps) {
  return (
    <>
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          title={collapsed ? label : undefined}
          onClick={onNavigate}
          onMouseEnter={() => prefetchRoute(to)}
          onFocus={() => prefetchRoute(to)}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              collapsed && "justify-center px-0",
              isActive
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && label}
        </NavLink>
      ))}
    </>
  );
}

/** Desktop sidebar navigation links. */
export function AppNavigation({ collapsed = false }: AppNavigationProps) {
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
      <NavItems collapsed={collapsed} />
    </nav>
  );
}

/** Mobile drawer navigation — sheet behind hamburger (§5.17). */
export function MobileSidebar() {
  const open = useUiStore((s) => s.isMobileSidebarOpen);
  const setOpen = useUiStore((s) => s.setMobileSidebarOpen);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent side="left" className="max-w-[15rem] border-r p-0">
        <DrawerHeader title="NexusOS" />
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          <NavItems onNavigate={() => setOpen(false)} />
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
