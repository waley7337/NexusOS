/** ChecklistCard — checkbox row + trailing tag Badge (Part 04, Phase 8). */
import { useId } from "react";
import { Badge } from "./badge";
import { Checkbox } from "./checkbox";
import { Label } from "./label";
import { cn } from "@/lib/utils";

interface ChecklistCardProps {
  label: string;
  tag?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}

export function ChecklistCard({ label, tag, checked, onCheckedChange, className }: ChecklistCardProps) {
  const checkboxId = useId();
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Checkbox
        id={checkboxId}
        checked={checked}
        onCheckedChange={(state) => onCheckedChange?.(state === true)}
      />
      <Label htmlFor={checkboxId} className="flex-1 cursor-pointer font-normal">
        {label}
      </Label>
      {tag && <Badge className="shrink-0">{tag}</Badge>}
    </div>
  );
}
