/** Drawer — side panel for detail views, mobile nav, and longer forms. Built on Radix Dialog. */
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

export const DrawerContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: "right" | "left" }
>(({ className, children, side = "right", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="overlay-scrim fixed inset-0 z-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:pointer-events-none" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "drawer-panel fixed inset-y-0 z-modal flex w-full max-w-md flex-col border-line-soft bg-surface-2 shadow-modal duration-spatial ease-in-out-quint",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        side === "right"
          ? "right-0 border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right"
          : "left-0 border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close asChild>
        <Button variant="ghost" size="icon" aria-label="Close" className="absolute right-3 top-3">
          <X />
        </Button>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DrawerContent.displayName = "DrawerContent";

export function DrawerHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-1.5 border-b border-line-soft p-5 pr-12">
      <DialogPrimitive.Title className="text-h3">{title}</DialogPrimitive.Title>
      {description && (
        <DialogPrimitive.Description className="text-sm text-muted-foreground">
          {description}
        </DialogPrimitive.Description>
      )}
    </div>
  );
}

export function DrawerBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex-1 overflow-y-auto p-5", className)}>{children}</div>;
}
