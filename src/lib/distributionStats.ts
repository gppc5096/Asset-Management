import { monthKey } from "@/lib/aggregate";
import { calcDistributionChange, calcPriceChange } from "@/lib/tax";
import type { DistributionRecord } from "@/lib/types";

/**
 * 분배금 계좌 화면의 파생 데이터 계산(순수 함수).
 * DistributionAccountView에서 분리 — 화면 없이 단위 테스트할 수 있다.
 */

export type RecordFilter = { start: string; end: string; search: string };

export type PriceDistributionChange = { priceChange: number; distributionChange: number };

/** 기록이 존재하는 월(YYYY-MM) 목록, 오름차순. */
export function listMonths(records: DistributionRecord[]): string[] {
  const set = new Set(records.map((r) => monthKey(r.date)));
  return [...set].sort();
}

/** 조회기간(포함)·종목 검색어로 거른 뒤 최신 거래일 순으로 정렬. */
export function filterRecords(
  records: DistributionRecord[],
  { start, end, search }: RecordFilter
): DistributionRecord[] {
  return records
    .filter((r) => {
      const mk = monthKey(r.date);
      if (start && mk < start) return false;
      if (end && mk > end) return false;
      if (search && !r.ticker.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** 저장된 등락값이 0이어도, 동일 종목 전달 대비로 화면에서 재계산한 값(id별). */
export function buildChangeById(
  records: DistributionRecord[]
): Map<string, PriceDistributionChange> {
  const map = new Map<string, PriceDistributionChange>();
  for (const r of records) {
    map.set(r.id, {
      priceChange: calcPriceChange(r, records),
      distributionChange: calcDistributionChange(r, records),
    });
  }
  return map;
}

/**
 * 요약 카드: 종목별 최신 기록 중 보유중인(held) 종목만 수량 합계와 가중평균 단가를 계산.
 * 종목별 최신 기록이 매도(보유여부="무")면 더 이상 보유 중이 아니므로 제외한다.
 */
export function summarizeHeld(filtered: DistributionRecord[]) {
  const map = new Map<string, DistributionRecord>();
  for (const r of filtered) {
    const cur = map.get(r.ticker);
    if (!cur || cur.date < r.date) map.set(r.ticker, r);
  }
  const latestPerTicker = [...map.values()].filter((r) => r.held);
  const totalQuantity = latestPerTicker.reduce((a, r) => a + r.quantity, 0);
  const weightedAvgPrice =
    totalQuantity > 0
      ? Math.round(
          latestPerTicker.reduce((a, r) => a + r.price * r.quantity, 0) / totalQuantity
        )
      : 0;
  return { totalQuantity, weightedAvgPrice };
}

/** 분배금총액(세전) 합계. */
export function sumDistributionReceived(filtered: DistributionRecord[]): number {
  return filtered.reduce((a, r) => a + r.distributionReceived, 0);
}

export function uniqueTickers(filtered: DistributionRecord[]): string[] {
  return [...new Set(filtered.map((r) => r.ticker))];
}

/** 월별 × 종목별 순수령액(total) 합. */
export function monthlyByTicker(filtered: DistributionRecord[]) {
  const map = new Map<string, Record<string, number>>();
  for (const r of filtered) {
    const mk = monthKey(r.date);
    const row = map.get(mk) ?? {};
    row[r.ticker] = (row[r.ticker] ?? 0) + r.total;
    map.set(mk, row);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, row]) => ({ month, ...row }));
}

/** 거래일별 종목 현주가 추이. */
export function priceTrend(filtered: DistributionRecord[]) {
  const dateSet = [...new Set(filtered.map((r) => r.date))].sort();
  return dateSet.map((date) => {
    const row: Record<string, number | string> = { date };
    for (const r of filtered.filter((x) => x.date === date)) {
      row[r.ticker] = r.price;
    }
    return row;
  });
}

/** 종목별 분배금(세전) 비중(%), 소수 첫째 자리 반올림. 전체가 0이면 분모 1. */
export function tickerShare(filtered: DistributionRecord[]) {
  const map = new Map<string, number>();
  for (const r of filtered) {
    map.set(r.ticker, (map.get(r.ticker) ?? 0) + r.distributionReceived);
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
  const row: Record<string, number> = {};
  for (const [ticker, v] of map.entries()) {
    row[ticker] = Math.round((v / total) * 1000) / 10;
  }
  return [row];
}

/** 월별 순수령액 vs 과세금액. */
export function monthlyNetVsTax(filtered: DistributionRecord[]) {
  const map = new Map<string, { total: number; taxAmount: number }>();
  for (const r of filtered) {
    const mk = monthKey(r.date);
    const row = map.get(mk) ?? { total: 0, taxAmount: 0 };
    row.total += r.total;
    row.taxAmount += r.taxAmount;
    map.set(mk, row);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, v]) => ({ month, ...v }));
}
