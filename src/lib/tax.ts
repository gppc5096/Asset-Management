import { toCsv, parseCsv, csvRowsToRecords } from "@/lib/csv";
import { monthKey } from "@/lib/aggregate";
import { previousMonthKeyFromDate } from "@/lib/date";
import type { DistributionCategory, DistributionRecord } from "@/lib/types";

export const WITHHOLDING_TAX_RATE = 0.154;

/**
 * 일반계좌/특별계좌만 원천징수 대상. 비과세계좌는 항상 0원 (실데이터 26건 전수 확인).
 */
export function calcTaxAmount(
  taxedDistribution: number,
  category: DistributionCategory
): number {
  if (category === "tax-free") return 0;
  return Math.round(taxedDistribution * WITHHOLDING_TAX_RATE);
}

export function calcNetTotal(distributionReceived: number, taxAmount: number): number {
  return distributionReceived - taxAmount;
}

export type DistributionInput = {
  quantity: number;
  distribution: number; // 주당 분배금
  taxBase: number; // 주당 과세대상 분배금
};

/**
 * 실데이터 51건 전수 검증된 파생 공식:
 * distributionReceived = distribution × quantity
 * taxedDistribution = taxBase × quantity
 * taxAmount = round(taxedDistribution × 0.154) (일반/특별), 비과세는 0
 * total = distributionReceived − taxAmount
 */
export function computeDistributionAmounts(
  input: DistributionInput,
  category: DistributionCategory
) {
  const distributionReceived = input.distribution * input.quantity;
  const taxedDistribution = input.taxBase * input.quantity;
  const taxAmount = calcTaxAmount(taxedDistribution, category);
  const total = calcNetTotal(distributionReceived, taxAmount);
  return { distributionReceived, taxedDistribution, taxAmount, total };
}

/** 동일 종목·전달(기록 일자 기준) 최신 기록. 없으면 null. */
function findPrevMonthRecord(
  record: Pick<DistributionRecord, "id" | "ticker" | "date">,
  allRecords: DistributionRecord[]
): DistributionRecord | null {
  const prevMonth = previousMonthKeyFromDate(record.date);
  let prev: DistributionRecord | null = null;
  for (const r of allRecords) {
    if (r.id === record.id) continue;
    if (r.ticker !== record.ticker) continue;
    if (monthKey(r.date) !== prevMonth) continue;
    if (!prev || r.date > prev.date) prev = r;
  }
  return prev;
}

/**
 * 동일 종목의 전달 최신 현주가 대비 등락.
 * 전달 기록이 없으면 0.
 */
export function calcPriceChange(
  record: Pick<DistributionRecord, "id" | "ticker" | "date" | "price">,
  allRecords: DistributionRecord[]
): number {
  const prev = findPrevMonthRecord(record, allRecords);
  if (!prev) return 0;
  return record.price - prev.price;
}

/**
 * 동일 종목의 전달 최신 주당 분배금 대비 등락.
 * 전달 기록이 없으면 0.
 */
export function calcDistributionChange(
  record: Pick<DistributionRecord, "id" | "ticker" | "date" | "distribution">,
  allRecords: DistributionRecord[]
): number {
  const prev = findPrevMonthRecord(record, allRecords);
  if (!prev) return 0;
  return record.distribution - prev.distribution;
}

/** 전체 기록에 대해 주가등락·분배금등락을 다시 계산해 반영. */
export function withComputedPriceChanges(
  records: DistributionRecord[]
): DistributionRecord[] {
  return records.map((r) => ({
    ...r,
    priceChange: calcPriceChange(r, records),
    distributionChange: calcDistributionChange(r, records),
  }));
}

const DISTRIBUTION_CSV_HEADERS = [
  "거래일",
  "종목명",
  "주식수량",
  "현주가",
  "분배금",
  "과세표준",
  "보유여부",
] as const;

/** 원본 앱의 계좌별 '내보내기' CSV와 동일한 컬럼 구조. 계산된 필드(분배금총액 등)는 저장하지 않고 매번 재계산. */
export function distributionRecordsToCsv(records: DistributionRecord[]): string {
  const rows = records.map((r) => [
    r.date,
    r.ticker,
    r.quantity,
    r.price,
    r.distribution,
    r.taxBase,
    r.held ? "유" : "무",
  ]);
  return toCsv([...DISTRIBUTION_CSV_HEADERS], rows);
}

export function parseDistributionCsv(
  text: string,
  category: DistributionCategory
): DistributionRecord[] | null {
  const rows = parseCsv(text);
  if (rows.length === 0) return null;
  const header = rows[0].map((h) => h.trim());
  const hasAllHeaders = DISTRIBUTION_CSV_HEADERS.every((h) => header.includes(h));
  if (!hasAllHeaders) return null;

  const records = csvRowsToRecords(rows);
  const result: DistributionRecord[] = [];
  for (const r of records) {
    const date = r["거래일"];
    const ticker = r["종목명"];
    const quantity = Number(r["주식수량"]);
    const price = Number(r["현주가"] || 0);
    const distribution = Number(r["분배금"] || 0);
    const taxBase = Number(r["과세표준"] || 0);
    const heldRaw = r["보유여부"];

    const isValid =
      date &&
      ticker &&
      Number.isFinite(quantity) &&
      Number.isFinite(price) &&
      Number.isFinite(distribution) &&
      Number.isFinite(taxBase) &&
      (heldRaw === "유" || heldRaw === "무");
    if (!isValid) continue;

    const amounts = computeDistributionAmounts({ quantity, distribution, taxBase }, category);
    result.push({
      id: crypto.randomUUID(),
      date,
      ticker,
      quantity,
      price,
      distribution,
      taxBase,
      held: heldRaw === "유",
      priceChange: 0,
      distributionChange: 0,
      ...amounts,
    });
  }
  return withComputedPriceChanges(result);
}
