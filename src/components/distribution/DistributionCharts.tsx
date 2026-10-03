"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { colorForIndex } from "@/lib/chartColors";

type Props = {
  tickers: string[];
  monthlyByTicker: Record<string, number | string>[];
  priceTrend: Record<string, number | string>[];
  tickerShare: Record<string, number>[];
  monthlyNetVsTax: { month: string; total: number; taxAmount: number }[];
};

/** 분배금 계좌 화면의 차트 4종(월별 수령액, 현주가 추이, 종목별 비중, 순수령액 vs 과세금액). */
export function DistributionCharts({
  tickers,
  monthlyByTicker,
  priceTrend,
  tickerShare,
  monthlyNetVsTax,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">월별 분배금 수령액 추이 (종목별)</CardTitle>
        </CardHeader>
        <CardContent className="h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={monthlyByTicker}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              {tickers.map((t, i) => (
                <Bar key={t} name={t} dataKey={(row) => row[t]} stackId="a" fill={colorForIndex(i)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">종목별 현주가 추이</CardTitle>
        </CardHeader>
        <CardContent className="h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={priceTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              {tickers.map((t, i) => (
                <Line
                  key={t}
                  name={t}
                  type="monotone"
                  dataKey={(row) => row[t]}
                  stroke={colorForIndex(i)}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">종목별 분배금 비중 (조회 기간 전체)</CardTitle>
        </CardHeader>
        <CardContent className="h-40 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={tickerShare} layout="vertical">
              <XAxis type="number" hide domain={[0, 100]} />
              <YAxis type="category" dataKey={() => ""} hide />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend />
              {tickers.map((t, i) => (
                <Bar key={t} name={t} dataKey={(row) => row[t]} stackId="a" fill={colorForIndex(i)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">월별 순수령액 vs 과세금액</CardTitle>
        </CardHeader>
        <CardContent className="h-40 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={monthlyNetVsTax}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" name="순수령액" fill="#f5a524" />
              <Bar dataKey="taxAmount" name="과세금액" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
