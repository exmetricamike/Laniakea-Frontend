import * as React from "react";
import { cn } from "@/lib/utils";
export const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="w-full overflow-auto">
    <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
  </div>
));
Table.displayName = "Table";
export const TableHeader = (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className="border-b" {...props} />
);
export const TableBody = (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody {...props} />
);
export const TableRow = (props: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className="border-b transition-colors hover:bg-[var(--muted)]" {...props} />
);
export const TableHead = (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className="h-10 px-2 text-left align-middle font-medium text-[var(--muted-foreground)]"
    {...props}
  />
);
export const TableCell = (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className="p-2 align-middle" {...props} />
);
