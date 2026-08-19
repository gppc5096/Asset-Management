"use client";

import { useEffect, useState } from "react";
import { TrendingUp, X, DollarSign, Coins } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { localDateString } from "@/lib/date";

const STORAGE_KEY = "onboarding-dismissed-date";

type OnboardingModalProps = {
  totalKrw?: number;
  appliedUsdRate?: number;
  usdAssets?: number;
  krwAssets?: number;
};

export function OnboardingModal({
  totalKrw = 0,
  appliedUsdRate = 0,
  usdAssets = 0,
  krwAssets = 0,
}: OnboardingModalProps) {
  const [open, setOpen] = useState(false);
  const [dontShowToday, setDontShowToday] = useState(false);

  useEffect(() => {
    let dismissed: string | null = null;
    try {
      dismissed = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Safari 프라이빗 브라우징 등에서 localStorage 접근이 막힐 수 있음 — 매번 노출로 폴백
    }
    // localStorage는 브라우저에서만 읽을 수 있는 외부 시스템이라 effect에서 확인해야 함
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (dismissed !== localDateString()) setOpen(true);
  }, []);

  const close = () => {
    if (dontShowToday) {
      try {
        window.localStorage.setItem(STORAGE_KEY, localDateString());
      } catch {
        // 저장 실패해도 닫기 동작 자체는 계속 진행
      }
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-card shadow-2xl shadow-black/50">
        <div className="relative border-b border-white/10 bg-header px-6 py-8 text-center">
          <button
            onClick={close}
            className="absolute right-4 top-4 rounded-full bg-white/5 p-2 text-muted-foreground ring-1 ring-white/10 hover:bg-white/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <TrendingUp className="mx-auto mb-2 h-8 w-8 text-primary" />
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            My Asset Portfolio
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">오늘의 자산 현황 요약</p>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-xl border border-white/8 bg-desk p-5 text-center">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">
              TOTAL ESTIMATED ASSETS
            </p>
            <p className="mt-1 font-mono text-3xl font-extrabold text-foreground">
              ₩{Math.round(totalKrw).toLocaleString()}
            </p>
            <span className="mt-2 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
              적용환율 (USD) ₩{appliedUsdRate.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4 text-sky-400" /> USD Assets
              </div>
              <p className="mt-1 font-mono text-lg font-bold text-sky-400">
                $
                {usdAssets.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Coins className="h-4 w-4 text-rose-400" /> KRW Assets
              </div>
              <p className="mt-1 font-mono text-lg font-bold text-rose-400">
                ₩{Math.round(krwAssets).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">(현금 + 국내주식)</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={dontShowToday}
                onCheckedChange={(v) => setDontShowToday(v === true)}
              />
              오늘 하루 보지 않기
            </label>
            <button
              onClick={close}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
