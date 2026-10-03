import { describe, expect, it } from "vitest";
import { buildTickerSuggestions } from "@/lib/tickerSuggestions";
import { makeRecord } from "@/test/factories";

const rec = (id: string, ticker: string, date: string, quantity: number) =>
  makeRecord({ id, ticker, date, quantity });
const names = (r: ReturnType<typeof buildTickerSuggestions>) => r.suggestions.map((s) => s.value);

const base = [
  rec("a", "A종목", "2026-07-10", 1),
  rec("b0", "B종목", "2026-08-05", 100),
  rec("b1", "B종목", "2026-09-05", 120),
  rec("c0", "C종목", "2026-09-20", 50),
  rec("d0", "D종목", "2026-09-01", 10),
  rec("d1", "D종목", "2026-09-25", 15),
  rec("c1", "C종목", "2026-10-02", 60),
];

describe("buildTickerSuggestions", () => {
  it("기록이 있는 가장 최근 2개월(9·10월)만 대상 — 7·8월에만 있는 종목은 제외", () => {
    const r = buildTickerSuggestions(base, "2026-10-03", null);
    expect(names(r)).toEqual(["B종목", "C종목", "D종목"]);
  });

  it("종목별 가장 늦은 거래일의 수량을 사용(합산 아님)", () => {
    const r = buildTickerSuggestions(base, "2026-10-03", null);
    expect(r.quantityByTicker.get("B종목")).toBe(120);
    expect(r.quantityByTicker.get("C종목")).toBe(60); // 9/20=50, 10/2=60
    expect(r.quantityByTicker.get("D종목")).toBe(15); // 9/1=10, 9/25=15
  });

  it("detail은 'N주'(천단위 콤마)", () => {
    const r = buildTickerSuggestions([rec("x", "E", "2026-10-01", 12345)], "2026-10-03", null);
    expect(r.suggestions[0].detail).toBe("12,345주");
  });

  it("대상월에 이미 있는 종목에만 '이미 등록됨' 배지", () => {
    const r = buildTickerSuggestions(base, "2026-10-03", null);
    const badge = Object.fromEntries(r.suggestions.map((s) => [s.value, s.badge]));
    expect(badge).toEqual({ B종목: undefined, C종목: "이미 등록됨", D종목: undefined });
  });

  it("대상월(거래일)을 바꾸면 배지도 바뀐다", () => {
    const r = buildTickerSuggestions(base, "2026-09-15", null);
    const badge = Object.fromEntries(r.suggestions.map((s) => [s.value, s.badge]));
    expect(badge).toEqual({ B종목: "이미 등록됨", C종목: "이미 등록됨", D종목: "이미 등록됨" });
  });

  it("수정 중인 기록 자신은 '이미 등록됨'에서 제외", () => {
    const rows = [rec("self", "X", "2026-10-02", 5)];
    expect(buildTickerSuggestions(rows, "2026-10-02", null).suggestions[0].badge).toBe("이미 등록됨");
    expect(buildTickerSuggestions(rows, "2026-10-02", "self").suggestions[0].badge).toBeUndefined();
  });

  it("기록이 없으면 빈 목록, 한 달뿐이면 그 달만, 빈 종목명은 무시", () => {
    expect(buildTickerSuggestions([], "2026-10-03", null).suggestions).toEqual([]);
    expect(names(buildTickerSuggestions([rec("z", "Z", "2026-05-01", 7)], "2026-10-03", null))).toEqual(["Z"]);
    expect(
      names(buildTickerSuggestions([rec("e", "", "2026-10-01", 7), rec("q", "Q", "2026-10-01", 3)], "2026-10-03", null))
    ).toEqual(["Q"]);
  });

  it("달력상 지난달에 데이터가 없어도 데이터가 있는 최근 2개월을 사용", () => {
    const r = buildTickerSuggestions([rec("o1", "OLD", "2026-03-01", 9), rec("o2", "OLD2", "2026-04-01", 8)], "2026-10-03", null);
    expect(names(r)).toEqual(["OLD", "OLD2"]);
  });

  it("가나다 순으로 정렬", () => {
    const rows = ["다", "가", "나"].map((t, i) => rec(`k${i}`, t, "2026-10-01", 1));
    expect(names(buildTickerSuggestions(rows, "2026-10-03", null))).toEqual(["가", "나", "다"]);
  });
});
