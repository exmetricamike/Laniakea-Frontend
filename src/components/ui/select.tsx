import * as SelectPrimitive from "@radix-ui/react-select";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
export const Select = SelectPrimitive.Root;
export const SelectTrigger = ({ className, ...props }: SelectPrimitive.SelectTriggerProps) => (
  <SelectPrimitive.Trigger
    className={cn(
      "flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
      className,
    )}
    {...props}
  />
);
export const SelectValue = SelectPrimitive.Value;
export const SelectContent = ({
  className,
  children,
  ...props
}: SelectPrimitive.SelectContentProps) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      className={cn("z-50 rounded-md border bg-[var(--card)] p-1 shadow-lg", className)}
      position="popper"
      {...props}
    >
      <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
);
export const SelectItem = ({ className, children, ...props }: SelectPrimitive.SelectItemProps) => (
  <SelectPrimitive.Item
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-[var(--muted)]",
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemIndicator className="absolute left-2">
      <Check className="size-4" />
    </SelectPrimitive.ItemIndicator>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
);
