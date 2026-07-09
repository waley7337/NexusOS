/**
 * Command Palette — ⌘K / Ctrl+K, available everywhere in the app shell.
 *
 * Static navigation + action providers. Feature modules register entity
 * search providers through CommandPaletteProvider in Parts 7+.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import { Plus, Moon, Sun } from "lucide-react";
import { PALETTE_PAGES } from "@/constants/routes";
import { useTheme } from "@/providers/theme-provider";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useUiStore } from "@/stores/ui";
import type { CommandPaletteProvider } from "@/components/command-palette-types";
import { toast } from "sonner";

export function CommandPalette() {
  const open = useUiStore((s) => s.isCommandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const toggleCommandPalette = useUiStore((s) => s.toggleCommandPalette);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  useKeyboardShortcut({ key: "k", meta: true }, () => toggleCommandPalette());
  useKeyboardShortcut({ key: "k", ctrl: true }, () => toggleCommandPalette());

  const providers = useMemo<CommandPaletteProvider[]>(() => {
    const run = (fn: () => void) => {
      setOpen(false);
      fn();
    };

    return [
      {
        id: "navigation",
        group: "Go to",
        search: () =>
          PALETTE_PAGES.map(({ label, to, icon }) => ({
            id: `nav-${to}`,
            label,
            value: `go ${label}`,
            icon,
            onSelect: () => run(() => navigate(to)),
          })),
      },
      {
        id: "actions",
        group: "Actions",
        search: () => [
          {
            id: "new-customer",
            label: "New customer",
            value: "new customer",
            icon: Plus,
            onSelect: () => run(() => toast.info("Customer creation ships with the CRM module.")),
          },
          {
            id: "toggle-theme",
            label: "Toggle theme",
            value: "toggle theme dark light",
            icon: theme === "dark" ? Sun : Moon,
            onSelect: () => run(() => setTheme(theme === "dark" ? "light" : "dark")),
          },
        ],
      },
    ];
  }, [navigate, setOpen, setTheme, theme]);

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

        {providers.map((provider) => (
          <Command.Group
            key={provider.id}
            heading={provider.group}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {provider.search().map(({ id, label, value, icon: Icon, onSelect }) => (
              <Command.Item
                key={id}
                value={value}
                onSelect={() => run(onSelect)}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-secondary"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {label}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
