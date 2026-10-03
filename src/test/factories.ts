import type { Cash, DistributionRecord, ExchangeRate, Holding } from "@/lib/types";

let seq = 0;
const nextId = () => `id-${++seq}`;

export function makeHolding(over: Partial<Holding> = {}): Holding {
  return {
    id: nextId(),
    ticker: "TICKER",
    date: "2026-08-01",
    broker: "증권사",
    accountNumber: "111",
    accountType: "일반계좌",
    assetType: "ETF주식",
    country: "KOR",
    tradeType: "매수",
    quantity: 10,
    unitPrice: 1000,
    buyAmount: 0,
    sellAmount: 0,
    appliedRate: 0,
    distributionCycle: "월말",
    ...over,
  };
}

/** 분배금 기록. 파생 금액은 quantity/distribution/taxBase로 일관되게 채운다(비과세 기준 세금 0). */
export function makeRecord(over: Partial<DistributionRecord> = {}): DistributionRecord {
  const quantity = over.quantity ?? 100;
  const distribution = over.distribution ?? 10;
  const taxBase = over.taxBase ?? 0;
  const distributionReceived = distribution * quantity;
  const taxedDistribution = taxBase * quantity;
  return {
    id: nextId(),
    ticker: "TICKER",
    date: "2026-09-15",
    quantity,
    price: 10000,
    distribution,
    distributionReceived,
    taxBase,
    taxAmount: 0,
    taxedDistribution,
    total: distributionReceived,
    held: true,
    priceChange: 0,
    distributionChange: 0,
    ...over,
  };
}

export const CASH: Cash = { krw: 40_000_000, usd: 200_000, updatedAt: "2026-09-24T00:00:00.000Z" };

export const ZERO_RATE: ExchangeRate = {
  rate: 0,
  source: "auto",
  fetchedAt: new Date(0).toISOString(),
};

export function rate(value: number): ExchangeRate {
  return { rate: value, source: "manual", fetchedAt: "2026-09-24T00:00:00.000Z" };
}
