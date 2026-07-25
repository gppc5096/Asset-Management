import type { DistributionRecord } from "@/lib/types";

export type MonthlyTotals = {
  distributionReceived: number;
  taxAmount: number;
  taxedDistribution: number;
  total: number;
};

const EMPTY_TOTALS: MonthlyTotals = {
  distributionReceived: 0,
  taxAmount: 0,
  taxedDistribution: 0,
  total: 0,
};

export function monthKey(dateStr: string) {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

export function yearOf(dateStr: string) {
  return dateStr.slice(0, 4);
}

export function sumByMonth(records: DistributionRecord[]) {
  const map = new Map<string, MonthlyTotals>();
  for (const r of records) {
    const key = monthKey(r.date);
    const acc = map.get(key) ?? { ...EMPTY_TOTALS };
    acc.distributionReceived += r.distributionReceived;
    acc.taxAmount += r.taxAmount;
    acc.taxedDistribution += r.taxedDistribution;
    acc.total += r.total;
    map.set(key, acc);
  }
  return map;
}

export function yearsInRecords(records: DistributionRecord[]) {
  const years = new Set(records.map((r) => yearOf(r.date)));
  return [...years].sort().reverse();
}

export function sumTotalForYear(records: DistributionRecord[], year: string) {
  return records
    .filter((r) => yearOf(r.date) === year)
    .reduce((acc, r) => acc + r.total, 0);
}
