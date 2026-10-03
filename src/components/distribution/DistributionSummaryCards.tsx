"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatKrw as krw } from "@/lib/format";

type Props = {
  totalQuantity: number;
  weightedAvgPrice: number;
  distributionSum: number;
};

/** 주식수량 합계 / 평균 주식 단가(가중평균) / 분배금 합계 요약 카드 3종. */
export function DistributionSummaryCards({ totalQuantity, weightedAvgPrice, distributionSum }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            주식수량 합계
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{totalQuantity.toLocaleString()} 주</p>
          <p className="text-xs text-muted-foreground">* 종목별 최신 데이터 기준, 보유중인 종목만</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            평균 주식 단가 (가중평균)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{weightedAvgPrice.toLocaleString()} 원</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            분배금 합계
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{krw(distributionSum)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
