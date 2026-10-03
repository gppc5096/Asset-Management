import { describe, expect, it } from "vitest";
import {
  accountNumberOptionsFor,
  accountTypeMap,
  accountTypePieData,
  brokerOptionsForCountry,
  currencyPieData,
  filterHoldings,
  listBrokers,
  tickerOptionsFor,
  tickerShareByCountry,
} from "@/lib/assetStats";
import { netPositions } from "@/lib/holdings";
import { makeHolding } from "@/test/factories";

const H = [
  makeHolding({ id: "1", ticker: "삼성", country: "KOR", broker: "A증권", accountNumber: "111", accountType: "일반계좌", date: "2026-08-01", quantity: 10, unitPrice: 70000 }),
  makeHolding({ id: "2", ticker: "카카오", country: "KOR", broker: "A증권", accountNumber: "112", accountType: "ISA", date: "2026-09-01", quantity: 4, unitPrice: 50000 }),
  makeHolding({ id: "3", ticker: "VOO", country: "USA", broker: "B증권", accountNumber: "222", accountType: "ISA", date: "2026-07-01", quantity: 3, unitPrice: 400 }),
  makeHolding({ id: "4", ticker: "QQQ", country: "USA", broker: "", accountNumber: "", accountType: "일반계좌", date: "2026-06-01", quantity: 1, unitPrice: 300 }),
];

describe("옵션 목록", () => {
  it("listBrokers: 빈 증권사 제외, 중복 제거", () => {
    expect(listBrokers(H)).toEqual(["A증권", "B증권"]);
    expect(listBrokers([])).toEqual([]);
  });

  it("국가 → 증권사 → 종목/계좌번호 계단식 옵션", () => {
    expect(brokerOptionsForCountry(H, "KOR")).toEqual(["A증권"]);
    expect(brokerOptionsForCountry(H, "USA")).toEqual(["B증권"]); // 빈 증권사 제외
    expect(tickerOptionsFor(H, "KOR", "")).toEqual(["삼성", "카카오"]); // 증권사 미선택 → 국가 전체
    expect(tickerOptionsFor(H, "USA", "B증권")).toEqual(["VOO"]);
    expect(accountNumberOptionsFor(H, "KOR", "A증권")).toEqual(["111", "112"]);
    expect(accountNumberOptionsFor(H, "USA", "")).toEqual(["222"]); // 빈 계좌번호 제외
  });

  it("accountTypeMap: 계좌번호 → 계좌유형, 같은 번호면 나중 항목이 우선", () => {
    const m = accountTypeMap([
      makeHolding({ accountNumber: "9", accountType: "일반계좌" }),
      makeHolding({ accountNumber: "9", accountType: "ISA" }),
    ]);
    expect(m.get("9")).toBe("ISA");
    expect(accountTypeMap(H).get("222")).toBe("ISA");
  });
});

describe("filterHoldings", () => {
  it("'전체'는 제한 없음, 최신 거래일 순 정렬", () => {
    const out = filterHoldings(H, { accountType: "전체", broker: "전체", search: "" });
    expect(out.map((h) => h.id)).toEqual(["2", "1", "3", "4"]);
  });

  it("계좌유형·증권사·검색어를 모두 만족해야 포함(검색은 대소문자 무시)", () => {
    expect(filterHoldings(H, { accountType: "ISA", broker: "전체", search: "" }).map((h) => h.id)).toEqual(["2", "3"]);
    expect(filterHoldings(H, { accountType: "ISA", broker: "B증권", search: "" }).map((h) => h.id)).toEqual(["3"]);
    expect(filterHoldings(H, { accountType: "전체", broker: "전체", search: "voo" }).map((h) => h.id)).toEqual(["3"]);
    expect(filterHoldings(H, { accountType: "ISA", broker: "A증권", search: "voo" })).toEqual([]);
  });

  it("원본 배열을 변경하지 않는다", () => {
    const copy = H.map((h) => h.id);
    filterHoldings(H, { accountType: "전체", broker: "전체", search: "" });
    expect(H.map((h) => h.id)).toEqual(copy);
  });
});

describe("차트 데이터", () => {
  const positions = netPositions(H);

  it("currencyPieData: KRW/USD(환산) 두 조각", () => {
    expect(currencyPieData({ krwAssets: 100, usdAssetsKrw: 250 })).toEqual([
      { name: "KRW 자산", value: 100 },
      { name: "USD 자산 (KRW환산)", value: 250 },
    ]);
  });

  it("accountTypePieData: 계좌유형별 평가금액 합", () => {
    expect(accountTypePieData(positions)).toEqual([
      { name: "일반계좌", value: 10 * 70000 + 1 * 300 },
      { name: "ISA", value: 4 * 50000 + 3 * 400 },
    ]);
    expect(accountTypePieData([])).toEqual([]);
  });

  it("tickerShareByCountry: KOR은 krw, 그 외는 usd로 순보유수량 합산", () => {
    expect(tickerShareByCountry(positions)).toEqual({
      krw: { 삼성: 10, 카카오: 4 },
      usd: { VOO: 3, QQQ: 1 },
    });
  });
});
