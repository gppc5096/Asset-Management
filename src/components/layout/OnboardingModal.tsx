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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="relative bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-8 text-center text-white">
          <button
            onClick={close}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 hover:bg-white/30"
          >
            <X className="h-4 w-4" />
          </button>
          <TrendingUp className="mx-auto mb-2 h-8 w-8" />
          <h2 className="text-xl font-bold">My Asset Portfolio</h2>
          <p className="mt-1 text-sm text-white/80">오늘의 자산 현황 요약</p>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-xl bg-neutral-50 p-5 text-center">
            <p className="text-xs font-semibold tracking-wide text-neutral-400">
              TOTAL ESTIMATED ASSETS
            </p>
            <p className="mt-1 text-3xl font-extrabold">
              ₩{Math.round(totalKrw).toLocaleString()}
            </p>
            <span className="mt-2 inline-block rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium">
              적용환율 (USD) ₩{appliedUsdRate.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-blue-50 p-4">
              <div className="flex items-center gap-1 text-sm text-neutral-500">
                <DollarSign className="h-4 w-4" /> USD Assets
              </div>
              <p className="mt-1 text-lg font-bold text-blue-600">
                $
                {usdAssets.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="rounded-xl bg-red-50 p-4">
              <div className="flex items-center gap-1 text-sm text-neutral-500">
                <Coins className="h-4 w-4" /> KRW Assets
              </div>
              <p className="mt-1 text-lg font-bold text-red-600">
                ₩{Math.round(krwAssets).toLocaleString()}
              </p>
              <p className="text-xs text-neutral-400">(현금 + 국내주식)</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-sm text-neutral-500">
              <Checkbox
                checked={dontShowToday}
                onCheckedChange={(v) => setDontShowToday(v === true)}
              />
              오늘 하루 보지 않기
            </label>
            <button
              onClick={close}
              className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
