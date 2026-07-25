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
    <div className="flex min-h-dvh flex-col bg-neutral-50">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 font-bold text-lg">
          <LayoutGrid className="h-5 w-5 text-violet-600" />
          Asset Management
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-violet-100 text-violet-700"
                    : "text-neutral-600 hover:bg-neutral-100"
                )}
              >
                {item.desktopLabel}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span className="hidden sm:inline">{user?.email}</span>
          <button
            onClick={() => void signOut()}
            className="flex items-center gap-1 hover:text-neutral-800"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">로그아웃</span>
          </button>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-0">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs",
                active ? "text-violet-600" : "text-neutral-400"
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
