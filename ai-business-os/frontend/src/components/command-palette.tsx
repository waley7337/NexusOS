/**
 * Command Palette — ⌘K / Ctrl+K, available everywhere in the app shell.
 *
 * Part 2 scope: navigation + quick actions with static definitions.
 * When modules ship, each registers a search provider here so customers,
 * invoices, tasks, documents, etc. appear in the same palette.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import {
  LayoutDashboard, Users, FolderKanban, CheckSquare, UserRound, Wallet,
  Boxes, FileText, BarChart3, Sparkles, Settings, Plus, Moon, Sun, Palette,
} from "lucide-react";
import { useTheme } from "@/providers/theme-provider";
import { toast } from "sonner";

const PAGES = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "CRM", to: "/crm", icon: Users },
  { label: "Projects", to: "/projects", icon: FolderKanban },
  { label: "Tasks", to: "/tasks", icon: CheckSquare },
  { label: "HR", to: "/hr", icon: UserRound },
  { label: "Finance", to: "/finance", icon: Wallet },
  { label: "Inventory", to: "/inventory", icon: Boxes },
  { label: "Documents", to: "/documents", icon: FileText },
  { label: "Reports", to: "/reports", icon: BarChart3 },
  { label: "AI Assistant", to: "/assistant", icon: Sparkles },
  { label: "Settings", to: "/settings", icon: Settings },
  { label: "Design system", to: "/design", icon: Palette },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global search"
      className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border bg-card shadow-2xl"
    >
      {open && (
        <div
          className="fixed inset-0 -z-10 bg-black/40"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}
      <Command.Input
        placeholder="Search pages, actions…"
        className="w-full border-b bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground"
      />
      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
          Nothing matches that. Try a page or action name.
        </Command.Empty>

        <Command.Group
          heading="Go to"
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          {PAGES.map(({ label, to, icon: Icon }) => (
            <Command.Item
              key={to}
              value={`go ${label}`}
              onSelect={() => run(() => navigate(to))}
              className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-secondary"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              {label}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group
          heading="Actions"
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          <Command.Item
            value="new customer"
            onSelect={() => run(() => toast.info("Customer creation ships with the CRM module."))}
            className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-secondary"
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
            New customer
          </Command.Item>
          <Command.Item
            value="toggle theme dark light"
            onSelect={() => run(() => setTheme(theme === "dark" ? "light" : "dark"))}
            className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-secondary"
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
            Toggle theme
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
