"use client";

import { useMemo, useState } from "react";
import { Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { currentHoldingsSummary, type HoldingSummaryGroupBy } from "@/lib/holdings";
import { cn } from "@/lib/utils";
import type { Holding } from "@/lib/types";

type Props = {
  holdings: Holding[];
  exchangeRate: number;
};

function usd(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function krw(n: number) {
  return `₩${Math.round(n).toLocaleString()}`;
}

export function HoldingsSummarySection({ holdings, exchangeRate }: Props) {
  const [groupBy, setGroupBy] = useState<HoldingSummaryGroupBy>("account");
  const [currency, setCurrency] = useState<"USD" | "KOR">("USD");

  const all = useMemo(() => currentHoldingsSummary(holdings, groupBy), [holdings, groupBy]);
  const usdCount = useMemo(() => all.filter((p) => p.country === "USA").length, [all]);
  const korCount = useMemo(() => all.filter((p) => p.country === "KOR").length, [all]);

  const rows = useMemo(
    () => all.filter((p) => p.country === (currency === "USD" ? "USA" : "KOR")),
    [all, currency]
  );

  const totalBuyAmount = rows.reduce((a, r) => a + r.totalBuyAmount, 0);
  const totalBuyAmountKrw =
    currency === "USD" ? totalBuyAmount * exchangeRate : totalBuyAmount;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold">
            <Globe className="h-5 w-5 text-violet-600" />
            현재 보유 종목 현황
            <span className="text-sm font-normal text-neutral-400">(잔량 기준)</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border p-1">
              {(
                [
                  { key: "account", label: "계좌별" },
                  { key: "ticker", label: "종목별" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setGroupBy(opt.key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                    groupBy === opt.key
                      ? "bg-violet-600 text-white"
                      : "text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-full border p-1">
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  currency === "USD"
                    ? "bg-violet-600 text-white"
                    : "text-neutral-500 hover:text-neutral-800"
                )}
              >
                🇺🇸 USD {usdCount}
              </button>
              <button
                type="button"
                onClick={() => setCurrency("KOR")}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  currency === "KOR"
                    ? "bg-violet-600 text-white"
                    : "text-neutral-500 hover:text-neutral-800"
                )}
              >
                🇰🇷 KOR {korCount}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <div>
            총 매입금액 ({currency === "USD" ? "USD" : "KRW"}){" "}
            <span className="font-bold text-violet-600">
              {currency === "USD" ? usd(totalBuyAmount) : krw(totalBuyAmount)}
            </span>
            {currency === "USD" && (
              <span className="text-neutral-400"> ≈ {krw(totalBuyAmountKrw)}</span>
            )}
          </div>
          <div className="text-neutral-400">적용환율 {krw(exchangeRate)}</div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>종목명</TableHead>
                <TableHead>계좌유형</TableHead>
                <TableHead>증권사</TableHead>
                <TableHead>분배주기</TableHead>
                <TableHead>보유수량</TableHead>
                {currency === "USD" ? (
                  <>
                    <TableHead>평균매입가(USD)</TableHead>
                    <TableHead>총매입금(USD)</TableHead>
                    <TableHead>총매입금(KRW환산)</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>평균매입가(KRW)</TableHead>
                    <TableHead>총매입금(KRW)</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>
                    <div className="font-medium">{r.ticker}</div>
                    {r.accountNumber !== "-" && (
                      <div className="text-xs text-neutral-400">{r.accountNumber}</div>
                    )}
                  </TableCell>
                  <TableCell>{r.accountType}</TableCell>
                  <TableCell>{r.broker}</TableCell>
                  <TableCell>{r.distributionCycle}</TableCell>
                  <TableCell>{r.netQuantity.toLocaleString()} 주</TableCell>
                  {currency === "USD" ? (
                    <>
                      <TableCell className="text-violet-600">{usd(r.avgUnitPrice)}</TableCell>
                      <TableCell className="text-violet-600">{usd(r.totalBuyAmount)}</TableCell>
                      <TableCell className="font-medium">
                        {krw(r.totalBuyAmount * exchangeRate)}
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>{krw(r.avgUnitPrice)}</TableCell>
                      <TableCell className="font-medium">{krw(r.totalBuyAmount)}</TableCell>
                    </>
                  )}
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={currency === "USD" ? 8 : 7}
                    className="text-center text-neutral-400"
                  >
                    데이터가 없습니다
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="bg-neutral-900 font-bold text-white hover:bg-neutral-900">
                <TableCell colSpan={6}>합계</TableCell>
                {currency === "USD" ? (
                  <>
                    <TableCell className="text-amber-400">{usd(totalBuyAmount)}</TableCell>
                    <TableCell className="text-amber-400">{krw(totalBuyAmountKrw)}</TableCell>
                  </>
                ) : (
                  <TableCell className="text-amber-400">{krw(totalBuyAmount)}</TableCell>
                )}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
