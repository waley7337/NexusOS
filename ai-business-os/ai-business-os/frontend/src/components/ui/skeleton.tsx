/** Skeleton — the only loading state in NexusOS. Spinners are banned by the UX spec. */
import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-md bg-surface-4 motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}
