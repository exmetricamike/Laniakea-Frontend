import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;
export const TabsList = ({ className, ...props }: TabsPrimitive.TabsListProps) => (
  <TabsPrimitive.List
    className={cn("inline-flex items-center rounded-md bg-[var(--muted)] p-1", className)}
    {...props}
  />
);
export const TabsTrigger = ({ className, ...props }: TabsPrimitive.TabsTriggerProps) => (
  <TabsPrimitive.Trigger
    className={cn(
      "rounded px-3 py-1.5 text-sm text-[var(--muted-foreground)] transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
      "data-[state=active]:bg-[var(--background)] data-[state=active]:text-[var(--foreground)]",
      "data-[state=active]:shadow-sm",
      className,
    )}
    {...props}
  />
);
export const TabsContent = TabsPrimitive.Content;
