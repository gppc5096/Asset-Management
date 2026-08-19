"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentType } from "react";
import {
  LayoutGrid,
  Sparkles,
  Wallet,
  ShieldCheck,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { ScrollToTopButton } from "@/components/layout/ScrollToTopButton";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  desktopLabel: string;
  mobileLabel: string;
  icon: ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", desktopLabel: "대시보드", mobileLabel: "현황", icon: LayoutGrid },
  { href: "/special", desktopLabel: "특별계좌", mobileLabel: "특별", icon: Sparkles },
  { href: "/general", desktopLabel: "일반계좌", mobileLabel: "일반", icon: Wallet },
  { href: "/tax-free", desktopLabel: "비과세계좌", mobileLabel: "비과세", icon: ShieldCheck },
  { href: "/asset-config", desktopLabel: "자산관리", mobileLabel: "자산", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col bg-desk">
      <header className="sticky top-0 z-50 flex min-h-14 items-center justify-between border-b border-white/10 bg-secondary px-4 py-3.5 shadow-[0_1px_0_rgb(255_255_255/0.04)] sm:min-h-16 sm:px-6 md:bg-header">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
            <LayoutGrid className="h-4 w-4" />
          </span>
          Asset Management
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-primary ring-1 ring-primary/25"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                {item.desktopLabel}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="hidden sm:inline">{user?.email}</span>
          <button
            onClick={() => void signOut()}
            className="flex items-center gap-1 hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">로그아웃</span>
          </button>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-0">{children}</main>

      <ScrollToTopButton />

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-secondary pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.mobileLabel}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
