import { monthKey } from "@/lib/aggregate";
import type { DistributionRecord } from "@/lib/types";

export type TickerSuggestion = {
  value: string;
  /** 목록에 표시할 수량 문구 (예: "1,000주") */
  detail: string;
  /** 대상 월에 이미 등록된 종목이면 "이미 등록됨" */
  badge?: string;
};

export const ALREADY_REGISTERED_LABEL = "이미 등록됨";

/**
 * 자산 추가 다이얼로그의 종목명 추천 목록.
 * - 기준: 기록이 있는 가장 최근 2개월 (달력 기준이 아닌, 데이터가 있는 월)
 * - 종목별로 두 달 중 가장 늦은 거래일의 수량을 사용 (수량은 시점 보유량이라 합산하지 않음)
 * - targetDate가 속한 월에 같은 종목이 이미 있으면 badge 표시 (editingId 기록 자신은 제외)
 */
export function buildTickerSuggestions(
  records: DistributionRecord[],
  targetDate: string,
  editingId: string | null
): { suggestions: TickerSuggestion[]; quantityByTicker: Map<string, number> } {
  const recentMonths = new Set(
    [...new Set(records.map((r) => monthKey(r.date)))].sort().slice(-2)
  );

  const latestByTicker = new Map<string, DistributionRecord>();
  for (const r of records) {
    if (!recentMonths.has(monthKey(r.date)) || !r.ticker) continue;
    const cur = latestByTicker.get(r.ticker);
    if (!cur || cur.date < r.date) latestByTicker.set(r.ticker, r);
  }

  const quantityByTicker = new Map<string, number>();
  for (const [ticker, r] of latestByTicker) quantityByTicker.set(ticker, r.quantity);

  const targetMonth = monthKey(targetDate);
  const registered = new Set(
    records
      .filter((r) => r.id !== editingId && monthKey(r.date) === targetMonth)
      .map((r) => r.ticker)
  );

  const suggestions = [...quantityByTicker.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ko"))
    .map(([ticker, quantity]) => ({
      value: ticker,
      detail: `${quantity.toLocaleString()}주`,
      badge: registered.has(ticker) ? ALREADY_REGISTERED_LABEL : undefined,
    }));

  return { suggestions, quantityByTicker };
}
