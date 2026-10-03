"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { Holding } from "@/lib/types";

type Props = {
  visible: Holding[];
  totalCount: number;
  visibleCount: number;
  loading: boolean;
  onShowMore: () => void;
  onEdit: (holding: Holding) => void;
  onDelete: (id: string) => void;
};

/** 보유 종목 거래 원장 표 + "더보기". */
export function AssetTable({
  visible,
  totalCount,
  visibleCount,
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
              <TableHead>주식구분</TableHead>
              <TableHead>국가</TableHead>
              <TableHead>거래일</TableHead>
              <TableHead>증권사</TableHead>
              <TableHead>종목명</TableHead>
              <TableHead>계좌번호</TableHead>
              <TableHead>계좌유형</TableHead>
              <TableHead>거래</TableHead>
              <TableHead>배당주기</TableHead>
              <TableHead>수량</TableHead>
              <TableHead>매수금액</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((h) => (
              <TableRow key={h.id}>
                <TableCell>{h.assetType}</TableCell>
                <TableCell>{h.country}</TableCell>
                <TableCell>{h.date}</TableCell>
                <TableCell>{h.broker}</TableCell>
                <TableCell>{h.ticker}</TableCell>
                <TableCell>{h.accountNumber}</TableCell>
                <TableCell>{h.accountType}</TableCell>
                <TableCell>{h.tradeType}</TableCell>
                <TableCell>{h.distributionCycle}</TableCell>
                <TableCell>{h.quantity.toLocaleString()}</TableCell>
                <TableCell>{h.buyAmount.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => onEdit(h)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => onDelete(h.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {totalCount === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground">
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
