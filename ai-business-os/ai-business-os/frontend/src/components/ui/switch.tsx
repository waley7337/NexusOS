/** Toggle switch — §4.11. State change animates in 150ms (§4.23). */
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary-fill data-[state=unchecked]:bg-surface-4",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="block h-4 w-4 rounded-full bg-card shadow-sm transition-transform duration-fast motion-reduce:transition-none data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
