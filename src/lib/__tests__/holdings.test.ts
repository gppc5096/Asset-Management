import { describe, it, expect } from "vitest";
import {
  currentHoldingsSummary,
  holdingsToCsv,
  netPositions,
  parseHoldingsCsv,
  resolveUsdKrwRate,
  summarizeByCurrency,
} from "@/lib/holdings";
import { CASH, ZERO_RATE, makeHolding, rate } from "@/test/factories";

describe("netPositions", () => {
  it("종목+계좌 단위로 매수-매도를 합산하고 순수량이 0 이하면 제외한다", () => {
    const hs = [
      makeHolding({ ticker: "A", accountNumber: "1", quantity: 10, date: "2026-01-01" }),
      makeHolding({ ticker: "A", accountNumber: "1", quantity: 4, tradeType: "매도", date: "2026-02-01" }),
      makeHolding({ ticker: "B", accountNumber: "1", quantity: 5, date: "2026-01-01" }),
      makeHolding({ ticker: "B", accountNumber: "1", quantity: 5, tradeType: "매도", date: "2026-02-01" }), // 0 → 제외
      makeHolding({ ticker: "C", accountNumber: "1", quantity: 1, tradeType: "매도" }), // 음수 → 제외
    ];
    const out = netPositions(hs);
    expect(out.map((p) => [p.ticker, p.netQuantity])).toEqual([["A", 6]]);
  });

  it("같은 종목도 계좌번호가 다르면 별도 포지션이다", () => {
    const hs = [
      makeHolding({ ticker: "A", accountNumber: "1", quantity: 3 }),
      makeHolding({ ticker: "A", accountNumber: "2", quantity: 7 }),
    ];
    const out = netPositions(hs);
    expect(out.map((p) => p.netQuantity).sort()).toEqual([3, 7]);
  });

  it("평가금액은 순수량 × 가장 최근 거래일의 단가(근사치)", () => {
    const hs = [
      makeHolding({ ticker: "A", quantity: 10, unitPrice: 100, date: "2026-01-01" }),
      makeHolding({ ticker: "A", quantity: 10, unitPrice: 300, date: "2026-03-01" }),
      makeHolding({ ticker: "A", quantity: 10, unitPrice: 200, date: "2026-02-01" }),
    ];
    const [p] = netPositions(hs);
    expect(p.netQuantity).toBe(30);
    expect(p.latestUnitPrice).toBe(300);
    expect(p.value).toBe(9000);
  });

  it("거래가 없으면 빈 배열", () => {
    expect(netPositions([])).toEqual([]);
  });
});

describe("currentHoldingsSummary", () => {
  const hs = [
    makeHolding({ ticker: "A", accountNumber: "1", accountType: "일반계좌", broker: "X", quantity: 10, unitPrice: 100 }),
    makeHolding({ ticker: "A", accountNumber: "1", accountType: "일반계좌", broker: "X", quantity: 10, unitPrice: 200 }),
    makeHolding({ ticker: "A", accountNumber: "2", accountType: "ISA", broker: "Y", quantity: 20, unitPrice: 300 }),
    makeHolding({ ticker: "A", accountNumber: "2", accountType: "ISA", broker: "Y", quantity: 5, tradeType: "매도" }),
  ];

  it("계좌별: 종목+계좌 단위 가중평균 단가와 순수량", () => {
    const out = currentHoldingsSummary(hs, "account");
    expect(out).toHaveLength(2);
    const acc1 = out.find((r) => r.accountNumber === "1")!;
    expect(acc1.netQuantity).toBe(20);
    expect(acc1.avgUnitPrice).toBe(150); // (10*100+10*200)/20
    expect(acc1.totalBuyAmount).toBe(3000);
    const acc2 = out.find((r) => r.accountNumber === "2")!;
    expect(acc2.netQuantity).toBe(15); // 20 - 5
    expect(acc2.avgUnitPrice).toBe(300);
    expect(acc2.totalBuyAmount).toBe(4500);
  });

  it("종목별: 여러 계좌를 1행으로 합치고 서로 다른 값은 '-'로 표시", () => {
    const out = currentHoldingsSummary(hs, "ticker");
    expect(out).toHaveLength(1);
    const [r] = out;
    expect(r.netQuantity).toBe(35);
    expect(r.accountNumber).toBe("-");
    expect(r.accountType).toBe("-");
    expect(r.broker).toBe("-");
    // 매수만 가중평균: (10*100+10*200+20*300)/40 = 225
    expect(r.avgUnitPrice).toBe(225);
    expect(r.totalBuyAmount).toBe(225 * 35);
  });

  it("보유수량 0 이하는 제외하고 총매수금액 내림차순 정렬", () => {
    const list = [
      makeHolding({ ticker: "SMALL", accountNumber: "1", quantity: 1, unitPrice: 10 }),
      makeHolding({ ticker: "BIG", accountNumber: "1", quantity: 10, unitPrice: 1000 }),
      makeHolding({ ticker: "GONE", accountNumber: "1", quantity: 2, unitPrice: 5 }),
      makeHolding({ ticker: "GONE", accountNumber: "1", quantity: 2, tradeType: "매도" }),
    ];
    const out = currentHoldingsSummary(list, "account");
    expect(out.map((r) => r.ticker)).toEqual(["BIG", "SMALL"]);
  });
});

describe("resolveUsdKrwRate", () => {
  const usa = (appliedRate: number, date: string) =>
    makeHolding({ country: "USA", appliedRate, date });

  it("저장된 환율이 양수면 그 값을 우선한다", () => {
    expect(resolveUsdKrwRate(rate(1500), [usa(1410, "2026-09-01")])).toBe(1500);
  });
  it("저장 환율이 0이면 USA 종목의 가장 최근 적용환율로 폴백", () => {
    const hs = [usa(1380, "2026-07-01"), usa(1410, "2026-09-01"), usa(1395, "2026-08-01")];
    expect(resolveUsdKrwRate(ZERO_RATE, hs)).toBe(1410);
  });
  it("KOR 종목과 적용환율 0인 USA 종목은 폴백 대상이 아니다", () => {
    const hs = [makeHolding({ country: "KOR", appliedRate: 9999 }), usa(0, "2026-09-01")];
    expect(resolveUsdKrwRate(ZERO_RATE, hs)).toBe(0);
  });
  it("가장 최근 거래의 적용환율이 0이면 건너뛰고 그 이전의 유효한 환율을 쓴다", () => {
    const hs = [usa(1410, "2026-07-01"), usa(0, "2026-09-01")];
    expect(resolveUsdKrwRate(ZERO_RATE, hs)).toBe(1410);
  });
  it("NaN/음수 저장 환율은 무효로 보고 폴백한다", () => {
    expect(resolveUsdKrwRate(rate(NaN), [usa(1400, "2026-01-01")])).toBe(1400);
    expect(resolveUsdKrwRate(rate(-5), [usa(1400, "2026-01-01")])).toBe(1400);
  });
  it("아무 근거도 없으면 0", () => {
    expect(resolveUsdKrwRate(ZERO_RATE)).toBe(0);
  });
});

describe("summarizeByCurrency", () => {
  const holdings = [
    makeHolding({ ticker: "K", country: "KOR", quantity: 10, unitPrice: 1000 }), // 10,000원
    makeHolding({ ticker: "U", country: "USA", quantity: 2, unitPrice: 100, appliedRate: 1300 }), // $200
  ];

  it("KRW·USD 자산을 환율로 환산해 총자산을 계산한다", () => {
    const cash = { krw: 1000, usd: 50, updatedAt: "x" };
    const s = summarizeByCurrency(holdings, cash, rate(1400));
    expect(s.krwStockValue).toBe(10_000);
    expect(s.usdStockValue).toBe(200);
    expect(s.krwAssets).toBe(11_000);
    expect(s.usdAssets).toBe(250);
    expect(s.appliedUsdRate).toBe(1400);
    expect(s.usdAssetsKrw).toBe(350_000);
    expect(s.totalKrw).toBe(361_000);
  });

  it("저장 환율이 0이어도 USA 적용환율로 폴백해 USD 자산이 총자산에서 빠지지 않는다(회귀 방지)", () => {
    const s = summarizeByCurrency(holdings, CASH, ZERO_RATE);
    expect(s.appliedUsdRate).toBe(1300);
    expect(s.totalKrw).toBe(s.krwAssets + s.usdAssets * 1300);
    expect(s.totalKrw).toBeGreaterThan(s.krwAssets);
  });

  it("환율 근거가 전혀 없으면 USD 자산은 0원으로 환산(= 수동 입력 필요 상태)", () => {
    const s = summarizeByCurrency([makeHolding({ country: "USA", appliedRate: 0 })], CASH, ZERO_RATE);
    expect(s.appliedUsdRate).toBe(0);
    expect(s.usdAssetsKrw).toBe(0);
    expect(s.totalKrw).toBe(s.krwAssets);
  });

  it("보유 종목이 없으면 현금만 집계", () => {
    const s = summarizeByCurrency([], CASH, rate(1400));
    expect(s.totalKrw).toBe(CASH.krw + CASH.usd * 1400);
  });
});

describe("holdings CSV", () => {
  it("내보내기 → 가져오기 왕복 시 id를 제외한 모든 필드가 보존된다", () => {
    const original = [
      makeHolding({ ticker: "쉼표,포함", broker: '따옴표"포함', quantity: 3, unitPrice: 12.5, appliedRate: 1400, country: "USA" }),
      makeHolding({ ticker: "B", tradeType: "매도", distributionCycle: "분기" }),
    ];
    const parsed = parseHoldingsCsv(holdingsToCsv(original))!;
    expect(parsed).toHaveLength(2);
    parsed.forEach((p, i) => {
      const { id: _a, ...rest } = p;
      const { id: _b, ...expected } = original[i];
      void _a; void _b;
      expect(rest).toEqual({ ...expected, buyAmount: expected.buyAmount, sellAmount: expected.sellAmount });
    });
  });

  it("필수 헤더가 없으면 null", () => {
    expect(parseHoldingsCsv("a,b\n1,2")).toBeNull();
    expect(parseHoldingsCsv("")).toBeNull();
  });

  it("잘못된 행(허용되지 않는 값/숫자 아님/필수값 누락)은 건너뛴다", () => {
    const good = holdingsToCsv([makeHolding({ ticker: "OK" })]);
    const lines = good.split("\n");
    const bad1 = lines[1].replace("ETF주식", "없는구분");
    const bad2 = lines[1].replace(",KOR,", ",JPN,");
    const parsed = parseHoldingsCsv([lines[0], lines[1], bad1, bad2].join("\n"))!;
    expect(parsed.map((p) => p.ticker)).toEqual(["OK"]);
  });

  it("분배주기·적용환율 빈 값은 기본값('없음', 0)", () => {
    const csv = [
      "주식구분,국가,거래일,증권사,종목명,계좌번호,계좌유형,거래유형,분배주기,매입단가,수량,매수금액,매도금액,적용환율",
      "ETF주식,KOR,2026-01-01,증권,종목,1,일반계좌,매수,,1000,5,,,",
    ].join("\n");
    const [h] = parseHoldingsCsv(csv)!;
    expect(h.distributionCycle).toBe("없음");
    expect(h.appliedRate).toBe(0);
    expect(h.buyAmount).toBe(0);
  });
});
