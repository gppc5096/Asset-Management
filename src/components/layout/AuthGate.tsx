"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/AppShell";
import { OnboardingModal } from "@/components/layout/OnboardingModal";
import { useAssetConfigContext } from "@/components/providers/AssetConfigProvider";
import { summarizeByCurrency } from "@/lib/holdings";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signInWithGoogle } = useAuth();
  const { data: assetConfig } = useAssetConfigContext();
  const summary = useMemo(
    () =>
      summarizeByCurrency(
        assetConfig.holdings,
        assetConfig.cash,
        assetConfig.exchangeRate
      ),
    [assetConfig]
  );

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
        불러오는 중...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 text-center">
        <TrendingUp className="h-10 w-10 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Asset Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Google 계정으로 로그인해주세요
          </p>
        </div>
        <Button onClick={() => void signInWithGoogle()}>Google로 로그인</Button>
      </div>
    );
  }

  return (
    <AppShell>
      <OnboardingModal
        totalKrw={summary.totalKrw}
        appliedUsdRate={summary.appliedUsdRate}
        usdAssets={summary.usdAssets}
        krwAssets={summary.krwAssets}
      />
      {children}
    </AppShell>
  );
}
