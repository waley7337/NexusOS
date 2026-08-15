/**
 * Command Palette — ⌘K / Ctrl+K, available everywhere in the app shell.
 *
 * "Go to" and "Toggle theme" are sourced from useCaptureActions() — the
 * same registry the shell's Capture button reads. Only actions that
 * actually run are listed; unavailable modules do not appear as create
 * stubs. Feature modules register entity search providers through
 * CommandPaletteProvider when those APIs exist.
 */
import { useMemo } from "react";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useCaptureActions } from "@/hooks/useCaptureActions";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useUiStore } from "@/stores/ui";
import type { CommandPaletteProvider } from "@/components/command-palette-types";

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
        search: () =>
          themeAction
            ? [
                {
                  id: themeAction.id,
                  label: themeAction.label,
                  value: "toggle theme dark light",
                  icon: themeAction.icon,
                  onSelect: () => run(themeAction.onSelect),
                },
              ]
            : [],
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
      label="Page and action search"
      // Bug fix (Part 04 convergence, Commit C): the scrim used to be a
      // `fixed inset-0` div rendered *inside* the palette, and the palette
      // carries -translate-x-1/2 — a transform, which makes an element the
      // containing block for its fixed-position descendants. So the scrim was
      // sized to the palette's own box rather than the viewport; measured, no
      // full-viewport overlay existed and the page behind was never dimmed.
      //
      // cmdk exposes the real Radix parts: overlayClassName is a true sibling
      // overlay, and contentClassName is the positioned panel. Styling Content
      // rather than the inner Command also restores Radix's native
      // outside-click dismissal, which the old structure had shadowed.
      overlayClassName="overlay-scrim fixed inset-0 z-overlay data-[state=closed]:pointer-events-none"
      contentClassName="surface-raised dialog-panel fixed left-1/2 top-[14%] z-modal w-full max-w-xl -translate-x-1/2 overflow-hidden shadow-modal duration-standard data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1"
    >
      <div className="flex items-center gap-3 border-b border-line-soft px-4">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <Command.Input
          placeholder="Search pages and actions…"
          className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="kbd">esc</kbd>
      </div>

      <Command.List className="max-h-[52vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
          Nothing matches that. Try a page or action name.
        </Command.Empty>

        {providers.map((provider) => {
          const items = provider.search();
          if (items.length === 0) return null;

          return (
          <Command.Group
            key={provider.id}
            heading={provider.group}
            className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2"
          >
            {items.map(({ id, label, value, icon: Icon, onSelect }) => (
              // Selected row is a neutral raised fill with an accent icon —
              // the same language as the sidebar's active row, so "you are
              // here" and "this is selected" read as one system rather than
              // two different blue washes (Part 04 convergence, Commit C).
              <Command.Item
                key={id}
                value={value}
                onSelect={() => run(onSelect)}
                className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground data-[selected=true]:bg-surface-4 data-[selected=true]:text-foreground"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-4 text-muted-foreground group-data-[selected=true]:bg-primary/10 group-data-[selected=true]:text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="flex-1 truncate">{label}</span>
              </Command.Item>
            ))}
          </Command.Group>
          );
        })}
      </Command.List>

      <div className="flex items-center justify-between border-t border-line-soft px-4 py-2 font-mono text-2xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <kbd className="kbd">↑</kbd>
          <kbd className="kbd">↓</kbd>
          navigate
          <kbd className="kbd ml-1.5">↵</kbd>
          select
        </span>
        <span>NexusOS Command</span>
      </div>
    </Command.Dialog>
  );
}
