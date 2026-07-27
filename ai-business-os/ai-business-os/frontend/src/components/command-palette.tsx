/**
 * Command Palette — ⌘K / Ctrl+K, available everywhere in the app shell.
 *
 * "Go to" and "Toggle theme" are sourced from useCaptureActions() (Part 04,
 * Phase 6) — the same registry the shell's Capture button reads, so the two
 * "quick action" surfaces don't each hardcode their own copy. "New
 * customer" stays a palette-only stub (see useCaptureActions.ts for why).
 * Feature modules register entity search providers through
 * CommandPaletteProvider in Parts 7+.
 */
import { useMemo } from "react";
import { Command } from "cmdk";
import { Plus } from "lucide-react";
import { useCaptureActions } from "@/hooks/useCaptureActions";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useUiStore } from "@/stores/ui";
import type { CommandPaletteProvider } from "@/components/command-palette-types";
import { toast } from "sonner";

export function CommandPalette() {
  const open = useUiStore((s) => s.isCommandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const toggleCommandPalette = useUiStore((s) => s.toggleCommandPalette);
  const captureActions = useCaptureActions();

  useKeyboardShortcut({ key: "k", meta: true }, () => toggleCommandPalette());
  useKeyboardShortcut({ key: "k", ctrl: true }, () => toggleCommandPalette());

  const providers = useMemo<CommandPaletteProvider[]>(() => {
    const run = (fn: () => void) => {
      setOpen(false);
      fn();
    };

    const goToActions = captureActions.filter((a) => a.id.startsWith("go-"));
    const themeAction = captureActions.find((a) => a.id === "toggle-theme");

    return [
      {
        id: "navigation",
        group: "Go to",
        search: () =>
          goToActions.map((action) => ({
            id: action.id,
            label: action.label,
            value: `go ${action.label}`,
            icon: action.icon,
            onSelect: () => run(action.onSelect),
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
          ...(themeAction
            ? [
                {
                  id: themeAction.id,
                  label: themeAction.label,
                  value: "toggle theme dark light",
                  icon: themeAction.icon,
                  onSelect: () => run(themeAction.onSelect),
                },
              ]
            : []),
        ],
      },
    ];
  }, [captureActions, setOpen]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global search"
      className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden surface-glass ring-1 ring-primary/15"
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
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
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
