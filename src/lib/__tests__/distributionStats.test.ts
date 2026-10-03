import { describe, expect, it } from "vitest";
import {
  buildChangeById,
  filterRecords,
  listMonths,
  monthlyByTicker,
  monthlyNetVsTax,
  priceTrend,
  sumDistributionReceived,
  summarizeHeld,
  tickerShare,
  uniqueTickers,
} from "@/lib/distributionStats";
import { makeRecord } from "@/test/factories";

const R = [
  makeRecord({ id: "a1", ticker: "A", date: "2026-08-10", quantity: 100, price: 1000, distribution: 10, distributionReceived: 1000, total: 900, taxAmount: 100 }),
  makeRecord({ id: "a2", ticker: "A", date: "2026-09-10", quantity: 100, price: 1100, distribution: 12, distributionReceived: 1200, total: 1000, taxAmount: 200 }),
  makeRecord({ id: "b1", ticker: "B", date: "2026-09-05", quantity: 50, price: 2000, distribution: 20, distributionReceived: 1000, total: 1000, taxAmount: 0 }),
  makeRecord({ id: "b2", ticker: "B", date: "2026-10-02", quantity: 50, price: 2100, distribution: 0, distributionReceived: 0, total: 0, taxAmount: 0, held: false }),
];

describe("listMonths / filterRecords", () => {
  it("월 목록은 중복 없이 오름차순", () => {
    expect(listMonths(R)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(listMonths([])).toEqual([]);
  });

  it("조회기간(양끝 포함) + 검색어로 거르고 최신 거래일 순 정렬", () => {
    const out = filterRecords(R, { start: "2026-09", end: "2026-10", search: "" });
    expect(out.map((r) => r.id)).toEqual(["b2", "a2", "b1"]);
  });

  it("검색은 대소문자를 무시한 부분 일치", () => {
    expect(filterRecords(R, { start: "", end: "", search: "a" }).map((r) => r.id)).toEqual(["a2", "a1"]);
    expect(filterRecords(R, { start: "", end: "", search: "zzz" })).toEqual([]);
  });

  it("start/end가 빈 문자열이면 기간 제한 없음, 원본 배열은 변경하지 않음", () => {
    const copy = [...R];
    expect(filterRecords(R, { start: "", end: "", search: "" })).toHaveLength(4);
    expect(R).toEqual(copy);
  });
});

describe("buildChangeById", () => {
  it("동일 종목 전달 최신 기록 대비 주가·분배금 등락을 id별로 계산", () => {
    const m = buildChangeById(R);
    expect(m.get("a2")).toEqual({ priceChange: 100, distributionChange: 2 });
    expect(m.get("b2")).toEqual({ priceChange: 100, distributionChange: -20 });
    expect(m.get("a1")).toEqual({ priceChange: 0, distributionChange: 0 });
  });
});

describe("summarizeHeld / sumDistributionReceived", () => {
  it("종목별 최신 기록이 보유중인 종목만 수량 합·가중평균 단가에 포함", () => {
    // A 최신(9/10): 100주@1100 보유 / B 최신(10/2): 매도 → 제외
    expect(summarizeHeld(R)).toEqual({ totalQuantity: 100, weightedAvgPrice: 1100 });
  });

  it("가중평균은 반올림하고, 보유 종목이 없으면 0", () => {
    const rows = [
      makeRecord({ ticker: "X", date: "2026-01-01", quantity: 1, price: 100 }),
      makeRecord({ ticker: "Y", date: "2026-01-01", quantity: 2, price: 101 }),
    ];
    expect(summarizeHeld(rows).weightedAvgPrice).toBe(101); // (100+202)/3 = 100.67 → 101
    expect(summarizeHeld([makeRecord({ held: false })])).toEqual({ totalQuantity: 0, weightedAvgPrice: 0 });
    expect(summarizeHeld([])).toEqual({ totalQuantity: 0, weightedAvgPrice: 0 });
  });

  it("분배금총액 합계는 필터된 전체 기록 기준", () => {
    expect(sumDistributionReceived(R)).toBe(3200);
    expect(sumDistributionReceived([])).toBe(0);
  });
});

describe("차트용 집계", () => {
  const sorted = filterRecords(R, { start: "", end: "", search: "" });

  it("uniqueTickers: 등장 순서 유지", () => {
    expect(uniqueTickers(sorted)).toEqual(["B", "A"]);
  });

  it("monthlyByTicker: 월 오름차순, 종목별 순수령액 합", () => {
    expect(monthlyByTicker(sorted)).toEqual([
      { month: "2026-08", A: 900 },
      { month: "2026-09", A: 1000, B: 1000 },
      { month: "2026-10", B: 0 },
    ]);
  });

  it("priceTrend: 거래일 오름차순, 날짜별 종목 현주가", () => {
    expect(priceTrend(sorted)).toEqual([
      { date: "2026-08-10", A: 1000 },
      { date: "2026-09-05", B: 2000 },
      { date: "2026-09-10", A: 1100 },
      { date: "2026-10-02", B: 2100 },
    ]);
  });

  it("tickerShare: 분배금총액 비중(%) 소수 첫째 자리", () => {
    // A: 2200, B: 1000 → 68.75 → 68.8, 31.25 → 31.3
    expect(tickerShare(sorted)).toEqual([{ B: 31.3, A: 68.8 }]);
  });

  it("tickerShare: 전체 분배금이 0이어도 0으로 나눠지지 않는다", () => {
    expect(tickerShare([makeRecord({ ticker: "Z", distributionReceived: 0 })])).toEqual([{ Z: 0 }]);
    expect(tickerShare([])).toEqual([{}]);
  });

  it("monthlyNetVsTax: 월별 순수령액과 과세금액 합", () => {
    expect(monthlyNetVsTax(sorted)).toEqual([
      { month: "2026-08", total: 900, taxAmount: 100 },
      { month: "2026-09", total: 2000, taxAmount: 200 },
      { month: "2026-10", total: 0, taxAmount: 0 },
    ]);
  });
});
