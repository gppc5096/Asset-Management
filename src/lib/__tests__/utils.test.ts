import { afterEach, describe, expect, it, vi } from "vitest";
import { monthKey, sumByMonth, sumTotalForYear, yearOf, yearsInRecords } from "@/lib/aggregate";
import { csvRowsToRecords, parseCsv, toCsv } from "@/lib/csv";
import { localDateString, previousMonthKey, previousMonthKeyFromDate } from "@/lib/date";
import { formatKrw, formatNumericInput, parseNumericInput } from "@/lib/format";
import { normalizeTimestamp } from "@/lib/firestore-utils";
import { isAssetConfig, isDistributionDoc } from "@/lib/validate";
import { ZERO_RATE, CASH, makeRecord } from "@/test/factories";

afterEach(() => vi.useRealTimers());

describe("aggregate", () => {
  it("monthKey/yearOf는 YYYY-MM-DD에서 잘라낸다", () => {
    expect(monthKey("2026-09-15")).toBe("2026-09");
    expect(yearOf("2026-09-15")).toBe("2026");
  });

  const records = [
    makeRecord({ date: "2025-12-10", distributionReceived: 100, taxAmount: 10, taxedDistribution: 50, total: 90 }),
    makeRecord({ date: "2026-01-05", distributionReceived: 200, taxAmount: 20, taxedDistribution: 80, total: 180 }),
    makeRecord({ date: "2026-01-25", distributionReceived: 300, taxAmount: 30, taxedDistribution: 90, total: 270 }),
  ];

  it("sumByMonth: 월별로 네 가지 합계를 누적", () => {
    const m = sumByMonth(records);
    expect(m.get("2026-01")).toEqual({
      distributionReceived: 500, taxAmount: 50, taxedDistribution: 170, total: 450,
    });
    expect(m.get("2025-12")!.total).toBe(90);
    expect(m.size).toBe(2);
  });

  it("yearsInRecords는 최신 연도가 먼저", () => {
    expect(yearsInRecords(records)).toEqual(["2026", "2025"]);
  });

  it("sumTotalForYear는 해당 연도의 순수령액 합", () => {
    expect(sumTotalForYear(records, "2026")).toBe(450);
    expect(sumTotalForYear(records, "2024")).toBe(0);
  });
});

describe("csv", () => {
  it("toCsv: BOM 추가, 콤마·따옴표·줄바꿈 필드는 따옴표로 감싸고 이스케이프", () => {
    const csv = toCsv(["a", "b"], [['x,y', 'he said "hi"'], ["line\nbreak", 3]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1)).toBe('a,b\n"x,y","he said ""hi"""\n"line\nbreak",3');
  });

  it("parseCsv: toCsv 결과를 그대로 복원(왕복)", () => {
    const rows = [['x,y', 'he said "hi"'], ["line\nbreak", "3"]];
    expect(parseCsv(toCsv(["a", "b"], rows))).toEqual([["a", "b"], ...rows]);
  });

  it("parseCsv: CRLF/CR 정규화, BOM 제거, 빈 줄 무시, 마지막 줄 개행 없음 허용", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n\r\n3,4")).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
    expect(parseCsv("a\rb")).toEqual([["a"], ["b"]]);
    expect(parseCsv("")).toEqual([]);
  });

  it("csvRowsToRecords: 헤더 기준 객체화, 모자란 셀은 빈 문자열, 헤더 공백 제거", () => {
    expect(csvRowsToRecords([[" a ", "b"], ["1"]])).toEqual([{ a: "1", b: "" }]);
    expect(csvRowsToRecords([])).toEqual([]);
  });
});

describe("date (TZ=Asia/Seoul로 고정)", () => {
  it("localDateString은 UTC가 아니라 로컬(KST) 날짜 — 자정 직후에도 하루가 밀리지 않는다", () => {
    // UTC로는 9/30 15:30 이지만 KST로는 10/01 00:30
    expect(localDateString(new Date("2026-09-30T15:30:00Z"))).toBe("2026-10-01");
  });

  it("previousMonthKey: 1월이면 전년 12월", () => {
    expect(previousMonthKey(new Date(2026, 0, 15))).toBe("2025-12");
    expect(previousMonthKey(new Date(2026, 9, 3))).toBe("2026-09");
  });

  it("previousMonthKeyFromDate: 정상/연초 경계", () => {
    expect(previousMonthKeyFromDate("2026-09-15")).toBe("2026-08");
    expect(previousMonthKeyFromDate("2026-01-31")).toBe("2025-12");
  });

  it("previousMonthKeyFromDate: 잘못된 날짜는 현재 기준 지난달로 대체", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 3) });
    expect(previousMonthKeyFromDate("")).toBe("2026-09");
    expect(previousMonthKeyFromDate("2026-13-01")).toBe("2026-09");
  });
});

describe("format", () => {
  it("parseNumericInput: 숫자와 소수점 하나만 남긴다", () => {
    expect(parseNumericInput("1,234,567")).toBe("1234567");
    expect(parseNumericInput("12.3.4")).toBe("12.34");
    expect(parseNumericInput("abc")).toBe("");
    expect(parseNumericInput("₩1,410.5원")).toBe("1410.5");
  });

  it("formatNumericInput: 천단위 콤마, 소수부 유지, 빈 값은 빈 값", () => {
    expect(formatNumericInput("30000000.5")).toBe("30,000,000.5");
    expect(formatNumericInput("1410")).toBe("1,410");
    expect(formatNumericInput("12.")).toBe("12.");
    expect(formatNumericInput("")).toBe("");
  });

  it("formatKrw: 반올림 후 ₩ 표기", () => {
    expect(formatKrw(1234.5)).toBe("₩1,235");
    expect(formatKrw(0)).toBe("₩0");
  });
});

describe("validate", () => {
  const config = { holdings: [], cash: CASH, exchangeRate: ZERO_RATE, updatedAt: "x" };

  it("isAssetConfig: 필수 구조가 있어야 true", () => {
    expect(isAssetConfig(config)).toBe(true);
    expect(isAssetConfig({ ...config, holdings: undefined })).toBe(false);
    expect(isAssetConfig({ ...config, cash: { krw: "1", usd: 1 } })).toBe(false);
    expect(isAssetConfig({ ...config, exchangeRate: {} })).toBe(false);
    expect(isAssetConfig(null)).toBe(false);
    expect(isAssetConfig("x")).toBe(false);
  });

  it("isDistributionDoc: records 배열 필요", () => {
    expect(isDistributionDoc({ records: [] })).toBe(true);
    expect(isDistributionDoc({ records: "no" })).toBe(false);
    expect(isDistributionDoc(undefined)).toBe(false);
  });
});

describe("normalizeTimestamp", () => {
  it("문자열은 그대로, Timestamp(toDate)는 ISO로, 그 외는 epoch", () => {
    expect(normalizeTimestamp("2026-09-24T00:00:00.000Z")).toBe("2026-09-24T00:00:00.000Z");
    const ts = { toDate: () => new Date("2026-10-01T00:00:00Z") };
    expect(normalizeTimestamp(ts)).toBe("2026-10-01T00:00:00.000Z");
    expect(normalizeTimestamp(undefined)).toBe(new Date(0).toISOString());
    expect(normalizeTimestamp({})).toBe(new Date(0).toISOString());
  });
});
