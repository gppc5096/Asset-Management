"use client";

import { Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatKrw as krw } from "@/lib/format";
import type { summarizeByCurrency } from "@/lib/holdings";

type Props = {
  summary: ReturnType<typeof summarizeByCurrency>;
  cash: { krw: number; usd: number };
  onEditRate: () => void;
  onEditCash: () => void;
};

/** 총 자산(추정) / USD 자산 / KRW 자산 요약 카드 3종. 연필 아이콘으로 환율·현금을 수정. */
export function AssetSummaryCards({ summary, cash, onEditRate, onEditCash }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            총 자산 (추정)
          </CardTitle>
          <Button variant="ghost" size="icon-sm" onClick={onEditRate} aria-label="적용환율 수정">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{krw(summary.totalKrw)}</p>
          <p className="text-xs text-muted-foreground">
            적용환율 (USD/KRW){" "}
            {summary.appliedUsdRate > 0
              ? krw(summary.appliedUsdRate)
              : "미설정 · 연필로 입력"}
          </p>
          {summary.usdAssets > 0 && summary.appliedUsdRate > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              KRW {krw(summary.krwAssets)} + USD환산 {krw(summary.usdAssetsKrw)}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            USD 자산
          </CardTitle>
          <Button variant="ghost" size="icon-sm" onClick={onEditCash}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-blue-600">
            ${summary.usdAssets.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            주식 ${summary.usdStockValue.toLocaleString()} + 현금 $
            {cash.usd.toLocaleString()}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            KRW 자산
          </CardTitle>
          <Button variant="ghost" size="icon-sm" onClick={onEditCash}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-red-600">{krw(summary.krwAssets)}</p>
          <p className="text-xs text-muted-foreground">
            주식 {krw(summary.krwStockValue)} + 현금 {krw(cash.krw)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
