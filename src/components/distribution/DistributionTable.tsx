"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { PriceDistributionChange } from "@/lib/distributionStats";
import type { DistributionRecord } from "@/lib/types";

type Props = {
  visible: DistributionRecord[];
  totalCount: number;
  visibleCount: number;
  changeById: Map<string, PriceDistributionChange>;
  loading: boolean;
  onShowMore: () => void;
  onEdit: (record: DistributionRecord) => void;
  onDelete: (id: string) => void;
};

/** 상승(+)은 rose, 하락(-)은 sky, 변동 없음은 muted 색으로 등락 값을 표시. */
function changeClass(value: number) {
  return value > 0 ? "text-rose-400" : value < 0 ? "text-sky-400" : "text-muted-foreground";
}

/** 분배금 기록 표 + "더보기". */
export function DistributionTable({
  visible,
  totalCount,
  visibleCount,
  changeById,
  loading,
  onShowMore,
  onEdit,
  onDelete,
}: Props) {
  return (
    <Card>
      <CardContent className="overflow-x-auto pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>거래일</TableHead>
              <TableHead>종목명</TableHead>
              <TableHead>주식수량</TableHead>
              <TableHead>현주가</TableHead>
              <TableHead>주가등락</TableHead>
              <TableHead>분배금</TableHead>
              <TableHead>분배금등락</TableHead>
              <TableHead>분배금총액</TableHead>
              <TableHead>과세표준</TableHead>
              <TableHead>과세분배액</TableHead>
              <TableHead>과세금액</TableHead>
              <TableHead>합계</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => {
              const { priceChange, distributionChange } = changeById.get(r.id) ?? {
                priceChange: 0,
                distributionChange: 0,
              };
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.date}</TableCell>
                  <TableCell className={r.held ? "" : "text-muted-foreground line-through"}>
                    {r.ticker}
                  </TableCell>
                  <TableCell>{r.quantity.toLocaleString()}</TableCell>
                  <TableCell>{r.price.toLocaleString()}</TableCell>
                  <TableCell className={changeClass(priceChange)}>
                    {priceChange > 0 ? "+" : ""}
                    {priceChange.toLocaleString()}
                  </TableCell>
                  <TableCell>{r.distribution.toLocaleString()}</TableCell>
                  <TableCell className={changeClass(distributionChange)}>
                    {distributionChange > 0 ? "+" : ""}
                    {distributionChange.toLocaleString()}
                  </TableCell>
                  <TableCell>{r.distributionReceived.toLocaleString()}</TableCell>
                  <TableCell>{r.taxBase.toLocaleString()}</TableCell>
                  <TableCell>{r.taxedDistribution.toLocaleString()}</TableCell>
                  <TableCell>{r.taxAmount.toLocaleString()}</TableCell>
                  <TableCell className="font-medium">{r.total.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={r.held ? "default" : "secondary"}>
                      {r.held ? "보유" : "매도"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => onEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => onDelete(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {totalCount === 0 && (
              <TableRow>
                <TableCell colSpan={14} className="text-center text-muted-foreground">
                  {loading ? "불러오는 중..." : "데이터가 없습니다"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {visibleCount < totalCount && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" size="sm" onClick={onShowMore}>
              더보기 ({visible.length} / {totalCount})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
