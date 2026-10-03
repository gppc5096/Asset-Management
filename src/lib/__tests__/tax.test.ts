import { describe, it, expect } from "vitest";
import {
  WITHHOLDING_TAX_RATE,
  calcDistributionChange,
  calcNetTotal,
  calcPriceChange,
  calcTaxAmount,
  computeDistributionAmounts,
  distributionRecordsToCsv,
  parseDistributionCsv,
  withComputedPriceChanges,
} from "@/lib/tax";
import { makeRecord } from "@/test/factories";

describe("세금 계산", () => {
  it("원천징수율은 15.4%", () => {
    expect(WITHHOLDING_TAX_RATE).toBe(0.154);
  });

  it("일반/특별계좌는 과세분배액 × 15.4%를 반올림", () => {
    expect(calcTaxAmount(1000, "general")).toBe(154);
    expect(calcTaxAmount(1000, "special")).toBe(154);
    expect(calcTaxAmount(333, "general")).toBe(51); // 51.282
    expect(calcTaxAmount(10, "general")).toBe(2); // 1.54 → 2
    expect(calcTaxAmount(0, "general")).toBe(0);
  });

  it("비과세계좌는 항상 0원", () => {
    expect(calcTaxAmount(1_000_000, "tax-free")).toBe(0);
  });

  it("순수령액 = 분배금총액 - 세금", () => {
    expect(calcNetTotal(10_000, 1_540)).toBe(8_460);
  });

  it("computeDistributionAmounts: 분배금총액·과세분배액·세금·합계를 한 번에 계산", () => {
    const r = computeDistributionAmounts({ quantity: 100, distribution: 50, taxBase: 40 }, "general");
    expect(r).toEqual({
      distributionReceived: 5000,
      taxedDistribution: 4000,
      taxAmount: 616, // 4000 × 0.154
      total: 4384,
    });
  });

  it("같은 입력도 비과세계좌는 세금 0, 합계 = 분배금총액", () => {
    const r = computeDistributionAmounts({ quantity: 100, distribution: 50, taxBase: 40 }, "tax-free");
    expect(r.taxAmount).toBe(0);
    expect(r.total).toBe(5000);
  });
});

describe("주가·분배금 등락", () => {
  const prev = makeRecord({ id: "p", ticker: "A", date: "2026-08-20", price: 1000, distribution: 10 });
  const prevEarlier = makeRecord({ id: "p0", ticker: "A", date: "2026-08-05", price: 900, distribution: 8 });
  const cur = makeRecord({ id: "c", ticker: "A", date: "2026-09-10", price: 1100, distribution: 12 });
  const all = [prevEarlier, prev, cur];

  it("동일 종목의 '전달 가장 늦은 기록' 대비 차이를 계산", () => {
    expect(calcPriceChange(cur, all)).toBe(100); // 1100 - 1000 (8/20 기준)
    expect(calcDistributionChange(cur, all)).toBe(2); // 12 - 10
  });

  it("전달 기록이 없으면 0", () => {
    expect(calcPriceChange(prevEarlier, all)).toBe(0);
    expect(calcDistributionChange(prevEarlier, all)).toBe(0);
  });

  it("다른 종목, 같은 달, 두 달 전 기록은 비교 대상이 아니다", () => {
    const other = makeRecord({ ticker: "B", date: "2026-08-20", price: 5 });
    const sameMonth = makeRecord({ ticker: "A", date: "2026-09-01", price: 5 });
    const older = makeRecord({ ticker: "A", date: "2026-07-31", price: 5 });
    expect(calcPriceChange(cur, [other, sameMonth, older, cur])).toBe(0);
  });

  it("자기 자신은 비교 대상에서 제외", () => {
    expect(calcPriceChange(prev, [prev])).toBe(0);
  });

  it("1월 기록의 전달은 전년 12월", () => {
    const dec = makeRecord({ ticker: "A", date: "2025-12-30", price: 700 });
    const jan = makeRecord({ ticker: "A", date: "2026-01-15", price: 750 });
    expect(calcPriceChange(jan, [dec, jan])).toBe(50);
  });

  it("withComputedPriceChanges: 전체 기록에 일괄 반영", () => {
    const out = withComputedPriceChanges(all);
    expect(out.find((r) => r.id === "c")!.priceChange).toBe(100);
    expect(out.find((r) => r.id === "c")!.distributionChange).toBe(2);
    expect(out.find((r) => r.id === "p0")!.priceChange).toBe(0);
  });
});

describe("분배금 CSV", () => {
  const rec = makeRecord({
    ticker: "쉼표,종목", date: "2026-09-10", quantity: 100, price: 1100,
    distribution: 12, taxBase: 10, held: false,
  });

  it("내보내기는 BOM과 7개 컬럼 헤더를 갖고 보유여부를 유/무로 표기", () => {
    const csv = distributionRecordsToCsv([rec, makeRecord({ held: true })]);
    expect(csv.startsWith("﻿거래일,종목명,주식수량,현주가,분배금,과세표준,보유여부")).toBe(true);
    const lines = csv.split("\n");
    expect(lines[1]).toBe('2026-09-10,"쉼표,종목",100,1100,12,10,무');
    expect(lines[2].endsWith(",유")).toBe(true);
  });

  it("가져오기: 계산 필드는 계좌 유형에 맞춰 재계산(일반 vs 비과세)", () => {
    const csv = distributionRecordsToCsv([rec]);
    const [general] = parseDistributionCsv(csv, "general")!;
    expect(general.distributionReceived).toBe(1200);
    expect(general.taxedDistribution).toBe(1000);
    expect(general.taxAmount).toBe(154);
    expect(general.total).toBe(1046);
    expect(general.held).toBe(false);
    const [taxFree] = parseDistributionCsv(csv, "tax-free")!;
    expect(taxFree.taxAmount).toBe(0);
    expect(taxFree.total).toBe(1200);
  });

  it("가져오기 후 전달 대비 등락이 채워진다", () => {
    const csv = distributionRecordsToCsv([
      makeRecord({ ticker: "A", date: "2026-08-10", price: 1000, distribution: 10 }),
      makeRecord({ ticker: "A", date: "2026-09-10", price: 1050, distribution: 11 }),
    ]);
    const out = parseDistributionCsv(csv, "general")!;
    const sep = out.find((r) => r.date === "2026-09-10")!;
    expect(sep.priceChange).toBe(50);
    expect(sep.distributionChange).toBe(1);
  });

  it("헤더 누락 시 null, 보유여부가 유/무가 아니거나 숫자가 아닌 행은 건너뜀", () => {
    expect(parseDistributionCsv("거래일,종목명\n2026-01-01,A", "general")).toBeNull();
    expect(parseDistributionCsv("", "general")).toBeNull();
    const header = "거래일,종목명,주식수량,현주가,분배금,과세표준,보유여부";
    const csv = [
      header,
      "2026-01-01,OK,10,100,1,1,유",
      "2026-01-01,BAD1,10,100,1,1,예",
      "2026-01-01,BAD2,abc,100,1,1,유",
      ",NODATE,10,100,1,1,유",
    ].join("\n");
    expect(parseDistributionCsv(csv, "general")!.map((r) => r.ticker)).toEqual(["OK"]);
  });

  it("현주가·분배금·과세표준이 비어 있으면 0으로 처리", () => {
    const csv = ["거래일,종목명,주식수량,현주가,분배금,과세표준,보유여부", "2026-01-01,A,10,,,,유"].join("\n");
    const [r] = parseDistributionCsv(csv, "general")!;
    expect([r.price, r.distribution, r.taxBase, r.total]).toEqual([0, 0, 0, 0]);
  });
});
