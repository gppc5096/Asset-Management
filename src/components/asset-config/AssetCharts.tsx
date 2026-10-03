"use client";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatKrw as krw } from "@/lib/format";
import { CHART_COLORS } from "@/lib/chartColors";
import type { NetPosition } from "@/lib/holdings";

type NamedValue = { name: string; value: number };

type Props = {
  currencyPie: NamedValue[];
  accountTypePie: NamedValue[];
  positions: NetPosition[];
  tickerShareByCountry: { krw: Record<string, number>; usd: Record<string, number> };
};

/** 자산관리 화면 차트·집계 카드 4종. */
export function AssetCharts({
  currencyPie,
  accountTypePie,
  positions,
  tickerShareByCountry,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">통화별 자산 구성 (KRW/USD 환산)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={currencyPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                {currencyPie.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => krw(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">통화별 종목 보유수량</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="mb-2 font-medium text-muted-foreground">KRW 종목</p>
            {Object.entries(tickerShareByCountry.krw).map(([t, q]) => (
              <div key={t} className="flex justify-between border-b py-1">
                <span className="truncate">{t}</span>
                <span>{q.toLocaleString()}주</span>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-2 font-medium text-muted-foreground">USD 종목</p>
            {Object.entries(tickerShareByCountry.usd).map(([t, q]) => (
              <div key={t} className="flex justify-between border-b py-1">
                <span className="truncate">{t}</span>
                <span>{q.toLocaleString()}주</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">계좌유형별 투자 비중</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={accountTypePie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                {accountTypePie.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => krw(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">종목별 보유 비중 (현재 평가금액 기준)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={positions} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" fontSize={11} />
              <YAxis type="category" dataKey="ticker" width={140} fontSize={10} />
              <Tooltip formatter={(v) => Number(v).toLocaleString()} />
              <Bar dataKey="value" fill="#f5a524" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
