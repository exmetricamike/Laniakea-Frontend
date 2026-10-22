"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Bell,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CircleDot,
  Landmark,
  OctagonAlert,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { clearTokens } from "@/lib/auth";
import { useMe } from "@/lib/api/queries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Mode = "live" | "paper";
type ModeState = { mode: Mode; setMode: (mode: Mode) => void };
type User = { email: string; is_staff: boolean };
type Item = { href: string; label: string; icon: LucideIcon; staff?: boolean };

export const useMode = create<ModeState>()(
  persist((set) => ({ mode: "live", setMode: (mode) => set({ mode }) }), {
    name: "laniakea.mode",
    // Rehydrated after mount (AppShell) so the server and first client render agree.
    skipHydration: true,
  }),
);

const items: Item[] = [
  { href: "/portfolio", label: "Portfolio", icon: ChartNoAxesCombined },
  { href: "/systems", label: "Systems", icon: SlidersHorizontal },
  { href: "/strategies", label: "Strategies", icon: BriefcaseBusiness },
  { href: "/backtests", label: "Backtests", icon: CircleDot },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/risk", label: "Risk", icon: ShieldAlert },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/operator", label: "Operator", icon: UserRound, staff: true },
];

function Hint({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="z-50 rounded bg-[var(--foreground)] px-2 py-1 text-xs text-[var(--background)]">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function ModeToggle() {
  const mode = useMode((state) => state.mode);
  const setMode = useMode((state) => state.setMode);

  return (
    <ToggleGroup
      type="single"
      value={mode}
      aria-label="Trading mode"
      className="flex rounded-md border p-0.5"
      onValueChange={(value) => {
        if (value === "live" || value === "paper") setMode(value);
      }}
    >
      <ToggleGroupItem
        value="live"
        className="rounded px-2 py-1 text-xs font-bold text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] data-[state=on]:bg-red-500/20"
      >
        LIVE
      </ToggleGroupItem>
      <ToggleGroupItem
        value="paper"
        className="rounded px-2 py-1 text-xs font-bold text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] data-[state=on]:bg-blue-500/20"
      >
        PAPER
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

function Sidebar({ isStaff }: { isStaff: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="border-b bg-[var(--card)] md:min-h-screen md:w-60 md:border-b-0 md:border-r">
      <div className="px-5 py-5 font-bold tracking-tight">LANIAKEA</div>
      <nav
        aria-label="Primary navigation"
        className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col"
      >
        {items
          .filter((item) => !item.staff || isStaff)
          .map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/portfolio" && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                  active
                    ? "bg-[var(--muted)] font-medium"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
      </nav>
    </aside>
  );
}

function UserMenu({ user }: { user: User | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();

  function logout() {
    queryClient.clear();
    clearTokens();
    router.replace("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="User menu">
          <UserRound className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-50 min-w-48 rounded-md border bg-[var(--card)] p-1 shadow-lg"
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-sm">
          {user?.email ?? "Account"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1 h-px bg-[var(--border)]" />
        <DropdownMenuItem
          className="cursor-pointer rounded px-2 py-1.5 text-sm outline-none focus:bg-[var(--muted)]"
          onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          Use {theme === "dark" ? "light" : "dark"} theme
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer rounded px-2 py-1.5 text-sm outline-none focus:bg-[var(--muted)]"
          onSelect={logout}
        >
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TopBar({ user }: { user: User | null }) {
  return (
    <header className="flex min-h-16 items-center justify-between border-b px-4 md:px-6">
      <ModeToggle />
      <div className="flex items-center gap-2">
        <Hint text="Available once risk controls are enabled">
          <span
            tabIndex={0}
            className="inline-flex rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <Button
              variant="outline"
              size="sm"
              disabled
              className="border-red-500 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <OctagonAlert className="size-4" aria-hidden />
              Kill switch
            </Button>
          </span>
        </Hint>
        <Hint text="No alerts">
          <span
            tabIndex={0}
            className="inline-flex rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <Button variant="ghost" size="icon" disabled aria-label="Alerts">
              <Bell className="size-4" />
            </Button>
          </span>
        </Hint>
        <Hint text="Live updates: offline">
          <span
            aria-label="Live updates: offline"
            className="inline-flex size-7 items-center justify-center"
          >
            <span className="size-2 rounded-full bg-zinc-500" />
          </span>
        </Hint>
        <UserMenu user={user} />
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: user } = useMe();

  useEffect(() => {
    void useMode.persist.rehydrate();
  }, []);

  return (
    <TooltipProvider>
      <div className="min-h-screen md:flex">
        <Sidebar isStaff={user?.is_staff === true} />
        <div className="min-w-0 flex-1">
          <TopBar user={user ?? null} />
          <main className="p-5 md:p-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
