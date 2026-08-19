"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, DollarSign, Coins, Wallet, CreditCard } from "lucide-react";
import {
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useAssetConfigContext } from "@/components/providers/AssetConfigProvider";
import { useDistributionRecords } from "@/hooks/useDistributionRecords";
import { HoldingsSummarySection } from "@/components/dashboard/HoldingsSummarySection";
import { summarizeByCurrency } from "@/lib/holdings";
import { yearOf, sumByMonth } from "@/lib/aggregate";
import type { DistributionCategory, DistributionRecord } from "@/lib/types";

const CATEGORY_LABEL: Record<DistributionCategory, string> = {
  special: "특별계좌",
  general: "일반계좌",
  "tax-free": "비과세계좌",
};

const CATEGORY_COLOR: Record<DistributionCategory, string> = {
  special: "#f5a524",
  general: "#38bdf8",
  "tax-free": "#34d399",
};

function krw(n: number) {
  return `₩${Math.round(n).toLocaleString()}`;
}


export function DashboardView() {
  const { data: assetConfig } = useAssetConfigContext();
  const special = useDistributionRecords("special");
  const general = useDistributionRecords("general");
  const taxFree = useDistributionRecords("tax-free");

  const byCategory: Record<DistributionCategory, DistributionRecord[]> = useMemo(
    () => ({
      special: special.data.records,
      general: general.data.records,
      "tax-free": taxFree.data.records,
    }),
    [special.data.records, general.data.records, taxFree.data.records]
  );

  const allRecords = useMemo(
    () => [...byCategory.special, ...byCategory.general, ...byCategory["tax-free"]],
    [byCategory]
  );

  const years = useMemo(() => {
    const set = new Set(allRecords.map((r) => yearOf(r.date)));
    return [...set].sort().reverse();
  }, [allRecords]);

  const [year, setYear] = useState<string>("");
  const effectiveYear = year || years[0] || String(new Date().getFullYear());

  // 정적 export라 서버(빌드 시각)와 클라이언트(뷰어 타임존)의 로케일 문자열이 달라질 수 있어
  // 마운트 후에만 포맷된 날짜를 렌더링해 하이드레이션 불일치를 피한다.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // 표준 "클라이언트 마운트 후에만 렌더" 패턴 — 서버/클라 로케일 문자열 불일치를 피하려는 의도적 동기 setState
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const summary = useMemo(
    () =>
      summarizeByCurrency(
        assetConfig.holdings,
        assetConfig.cash,
        assetConfig.exchangeRate
      ),
    [assetConfig]
  );

  const yearTotals = useMemo(
    () =>
      (Object.keys(byCategory) as DistributionCategory[]).map((cat) => {
        const total = byCategory[cat]
          .filter((r) => yearOf(r.date) === effectiveYear)
          .reduce((a, r) => a + r.total, 0);
        return { cat, total };
      }),
    [byCategory, effectiveYear]
  );
  const yearGrandTotal = yearTotals.reduce((a, v) => a + v.total, 0) || 1;

  const monthlyMaps = useMemo(
    () => ({
      special: sumByMonth(byCategory.special),
      general: sumByMonth(byCategory.general),
      "tax-free": sumByMonth(byCategory["tax-free"]),
    }),
    [byCategory]
  );

  const monthRows = useMemo(() => {
    const withoutCumulative = Array.from({ length: 12 }, (_, i) => {
      const mk = `${effectiveYear}-${String(i + 1).padStart(2, "0")}`;
      const specialTotal = monthlyMaps.special.get(mk)?.total ?? 0;
      const generalTotal = monthlyMaps.general.get(mk)?.total ?? 0;
      const taxFreeTotal = monthlyMaps["tax-free"].get(mk)?.total ?? 0;
      return {
        month: i + 1,
        special: specialTotal,
        general: generalTotal,
        taxFree: taxFreeTotal,
        monthTotal: specialTotal + generalTotal + taxFreeTotal,
      };
    });
    return withoutCumulative.reduce<Array<(typeof withoutCumulative)[number] & { cumulative: number }>>(
      (rows, row) => {
        const prevCumulative = rows.length ? rows[rows.length - 1].cumulative : 0;
        rows.push({ ...row, cumulative: prevCumulative + row.monthTotal });
        return rows;
      },
      []
    );
  }, [effectiveYear, monthlyMaps]);

  const taxRows = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const mk = `${effectiveYear}-${String(i + 1).padStart(2, "0")}`;
      const s = monthlyMaps.special.get(mk);
      const g = monthlyMaps.general.get(mk);
      return {
        month: i + 1,
        hasSpecial: s !== undefined,
        hasGeneral: g !== undefined,
        specialTaxed: s?.taxedDistribution ?? 0,
        specialTax: s?.taxAmount ?? 0,
        generalTaxed: g?.taxedDistribution ?? 0,
        generalTax: g?.taxAmount ?? 0,
        totalTaxed: (s?.taxedDistribution ?? 0) + (g?.taxedDistribution ?? 0),
        totalTax: (s?.taxAmount ?? 0) + (g?.taxAmount ?? 0),
      };
    });
  }, [effectiveYear, monthlyMaps]);

  const comboCharts = useMemo(() => {
    // rule: 계좌별로 분배금을 수령한 종목 중, 선택된 연도 데이터 기준 최신 상태가
    // '보유'인 종목만 차트로 보여준다 (매도된 종목은 제외)
    return (["special", "general", "tax-free"] as DistributionCategory[]).flatMap((cat) => {
      const records = byCategory[cat].filter((r) => yearOf(r.date) === effectiveYear);

      const latestByTicker = new Map<string, DistributionRecord>();
      for (const r of records) {
        const cur = latestByTicker.get(r.ticker);
        if (!cur || cur.date < r.date) latestByTicker.set(r.ticker, r);
      }
      const heldTickers = [...latestByTicker.entries()]
        .filter(([, r]) => r.held)
        .map(([ticker]) => ticker);

      return heldTickers.map((ticker) => {
        const points = records
          .filter((r) => r.ticker === ticker)
          .sort((a, b) => (a.date < b.date ? -1 : 1))
          .map((r) => ({
            date: r.date,
            distribution: r.distribution,
            price: r.price,
          }));
        return { cat, ticker, points };
      });
    });
  }, [byCategory, effectiveYear]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">통합 자산 현황</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {mounted
            ? `마지막 업데이트: ${new Date(assetConfig.updatedAt).toLocaleString("ko-KR")}`
            : " "}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 bg-header px-6 py-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-primary" /> 총 자산 현황 (KRW 환산, 추정)
          </div>
          <p className="mt-1 font-mono text-3xl font-extrabold tracking-tight text-foreground">
            {krw(summary.totalKrw)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            적용환율 (USD/KRW) ₩{summary.appliedUsdRate.toLocaleString()} · 최근
            매수단가 기준 추정치입니다
          </p>
        </div>
        <div className="grid grid-cols-2 bg-card">
          <div className="border-b border-r p-4">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4 text-sky-400" /> 해외주식 (USD)
            </div>
            <p className="text-lg font-bold text-sky-400">
              ${summary.usdStockValue.toLocaleString()}
            </p>
          </div>
          <div className="border-b p-4">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Coins className="h-4 w-4 text-rose-400" /> 국내주식 (KRW)
            </div>
            <p className="text-lg font-bold text-rose-400">
              {krw(summary.krwStockValue)}
            </p>
          </div>
          <div className="border-r p-4">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4 text-emerald-400" /> USD 현금
            </div>
            <p className="text-lg font-bold text-emerald-400">
              ${assetConfig.cash.usd.toLocaleString()}
            </p>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4 text-amber-500" /> KRW 현금
            </div>
            <p className="text-lg font-bold text-amber-600">
              {krw(assetConfig.cash.krw)}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">연도별 배당 수령액</CardTitle>
          <div className="flex gap-1">
            {years.map((y) => (
              <Button
                key={y}
                size="sm"
                variant={y === effectiveYear ? "default" : "outline"}
                onClick={() => setYear(y)}
              >
                {y}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">{effectiveYear}년 전체 수령액 (세후)</p>
            <p className="text-2xl font-bold">
              {krw(yearTotals.reduce((a, v) => a + v.total, 0))}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {yearTotals.map(({ cat, total }) => (
              <div key={cat}>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>{CATEGORY_LABEL[cat]}</span>
                  <span>{krw(total)}</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-100">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${(total / yearGrandTotal) * 100}%`,
                      backgroundColor: CATEGORY_COLOR[cat],
                    }}
                  />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {((total / yearGrandTotal) * 100).toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">월별 배당 수령액 추이 ({effectiveYear}년)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-900 text-white hover:bg-neutral-900">
                <TableHead className="text-white">월</TableHead>
                <TableHead className="text-white">특별계좌</TableHead>
                <TableHead className="text-white">일반계좌</TableHead>
                <TableHead className="text-white">비과세계좌</TableHead>
                <TableHead className="text-white">월 합계</TableHead>
                <TableHead className="text-white">누적액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthRows.map((row) => (
                <TableRow key={row.month}>
                  <TableCell>{row.month}월</TableCell>
                  <TableCell>{row.special ? krw(row.special) : "-"}</TableCell>
                  <TableCell>{row.general ? krw(row.general) : "-"}</TableCell>
                  <TableCell>{row.taxFree ? krw(row.taxFree) : "-"}</TableCell>
                  <TableCell className="font-medium">
                    {row.monthTotal ? krw(row.monthTotal) : "-"}
                  </TableCell>
                  <TableCell>{krw(row.cumulative)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-neutral-900 font-medium text-white hover:bg-neutral-900">
                <TableCell>합계</TableCell>
                <TableCell>
                  {krw(monthRows.reduce((a, r) => a + r.special, 0))}
                </TableCell>
                <TableCell>
                  {krw(monthRows.reduce((a, r) => a + r.general, 0))}
                </TableCell>
                <TableCell>
                  {krw(monthRows.reduce((a, r) => a + r.taxFree, 0))}
                </TableCell>
                <TableCell>
                  {krw(monthRows.reduce((a, r) => a + r.monthTotal, 0))}
                </TableCell>
                <TableCell>-</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">과세분배금 및 과세금액 현황 ({effectiveYear}년)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-900 text-white hover:bg-neutral-900">
                <TableHead className="text-white">월</TableHead>
                <TableHead className="text-white">특별계좌 과세분배금</TableHead>
                <TableHead className="text-white">특별계좌 과세금액</TableHead>
                <TableHead className="text-white">일반계좌 과세분배금</TableHead>
                <TableHead className="text-white">일반계좌 과세금액</TableHead>
                <TableHead className="text-white">합계 과세분배금</TableHead>
                <TableHead className="text-white">합계 과세금액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxRows.map((row) => (
                <TableRow key={row.month}>
                  <TableCell>{row.month}월</TableCell>
                  <TableCell>{row.hasSpecial ? row.specialTaxed.toLocaleString() : "-"}</TableCell>
                  <TableCell className="text-rose-400">
                    {row.hasSpecial ? row.specialTax.toLocaleString() : "-"}
                  </TableCell>
                  <TableCell>{row.hasGeneral ? row.generalTaxed.toLocaleString() : "-"}</TableCell>
                  <TableCell className="text-rose-400">
                    {row.hasGeneral ? row.generalTax.toLocaleString() : "-"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {row.hasSpecial || row.hasGeneral ? row.totalTaxed.toLocaleString() : "-"}
                  </TableCell>
                  <TableCell className="font-medium text-rose-400">
                    {row.hasSpecial || row.hasGeneral ? row.totalTax.toLocaleString() : "-"}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-neutral-900 font-medium text-white hover:bg-neutral-900">
                <TableCell>합계</TableCell>
                <TableCell>
                  {taxRows.reduce((a, r) => a + r.specialTaxed, 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-rose-300">
                  {taxRows.reduce((a, r) => a + r.specialTax, 0).toLocaleString()}
                </TableCell>
                <TableCell>
                  {taxRows.reduce((a, r) => a + r.generalTaxed, 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-rose-300">
                  {taxRows.reduce((a, r) => a + r.generalTax, 0).toLocaleString()}
                </TableCell>
                <TableCell>
                  {taxRows.reduce((a, r) => a + r.totalTaxed, 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-rose-300">
                  {taxRows.reduce((a, r) => a + r.totalTax, 0).toLocaleString()}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">주가등락 및 분배금 등락 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {comboCharts.map(({ cat, ticker, points }) => (
              <div key={`${cat}-${ticker}`} className="rounded-lg border p-4">
                <p className="mb-2 text-sm">
                  <span className="font-bold text-foreground">
                    {ticker || "데이터 없음"}
                  </span>
                  <span style={{ color: CATEGORY_COLOR[cat] }}> - {CATEGORY_LABEL[cat]}</span>
                </p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={points}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        fontSize={10}
                        tickFormatter={(d: string) => d.slice(5).replace("-", "/")}
                      />
                      <YAxis yAxisId="left" fontSize={11} />
                      <YAxis yAxisId="right" orientation="right" fontSize={11} />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="price"
                        name="주가"
                        stroke="#f5a524"
                        dot={{ r: 4, fill: "#161d2b", stroke: "#f5a524", strokeWidth: 2 }}
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="distribution"
                        name="주당 분배금"
                        fill="#f97316"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <HoldingsSummarySection
        holdings={assetConfig.holdings}
        exchangeRate={summary.appliedUsdRate}
      />
    </div>
  );
}
