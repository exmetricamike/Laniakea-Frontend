import { cn } from "@/lib/utils";
export function ModeBadge({ mode }: { mode: "live" | "paper" }) {
  return (
    <span
      className={cn(
        "rounded px-2 py-1 text-xs font-bold",
        mode === "live" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400",
      )}
    >
      {mode === "live" ? "LIVE" : "PAPER"}
    </span>
  );
}
