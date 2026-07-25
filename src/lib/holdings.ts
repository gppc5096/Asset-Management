import { toCsv, parseCsv, csvRowsToRecords } from "@/lib/csv";
import {
  ACCOUNT_TYPES,
  ASSET_TYPES,
  COUNTRIES,
  TRADE_TYPES,
  DISTRIBUTION_CYCLES,
  type Cash,
  type ExchangeRate,
  type Holding,
} from "@/lib/types";

const HOLDINGS_CSV_HEADERS = [
  "주식구분",
  "국가",
  "거래일",
  "증권사",
  "종목명",
  "계좌번호",
  "계좌유형",
  "거래유형",
  "분배주기",
  "매입단가",
  "수량",
  "매수금액",
  "매도금액",
  "적용환율",
] as const;

/** 원본 앱의 '자산관리 내보내기' CSV와 동일한 컬럼 구조 (id는 내부 전용이라 미포함). */
export function holdingsToCsv(holdings: Holding[]): string {
  const rows = holdings.map((h) => [
    h.assetType,
    h.country,
    h.date,
    h.broker,
    h.ticker,
    h.accountNumber,
    h.accountType,
    h.tradeType,
    h.distributionCycle,
    h.unitPrice,
    h.quantity,
    h.buyAmount,
    h.sellAmount,
    h.appliedRate,
  ]);
  return toCsv([...HOLDINGS_CSV_HEADERS], rows);
}

export function parseHoldingsCsv(text: string): Holding[] | null {
  const rows = parseCsv(text);
  if (rows.length === 0) return null;
  const header = rows[0].map((h) => h.trim());
  const hasAllHeaders = HOLDINGS_CSV_HEADERS.every((h) => header.includes(h));
  if (!hasAllHeaders) return null;

  const records = csvRowsToRecords(rows);
  const holdings: Holding[] = [];
  for (const r of records) {
    const assetType = r["주식구분"];
    const country = r["국가"];
    const accountType = r["계좌유형"];
    const tradeType = r["거래유형"];
    const distributionCycle = r["분배주기"] || "없음";
    const quantity = Number(r["수량"]);
    const unitPrice = Number(r["매입단가"]);
    const buyAmount = Number(r["매수금액"] || 0);
    const sellAmount = Number(r["매도금액"] || 0);
    const appliedRate = Number(r["적용환율"] || 0);

    const isValid =
      (ASSET_TYPES as readonly string[]).includes(assetType) &&
      (COUNTRIES as readonly string[]).includes(country) &&
      (ACCOUNT_TYPES as readonly string[]).includes(accountType) &&
      (TRADE_TYPES as readonly string[]).includes(tradeType) &&
      (DISTRIBUTION_CYCLES as readonly string[]).includes(distributionCycle) &&
      r["종목명"] &&
      r["거래일"] &&
      Number.isFinite(quantity) &&
      Number.isFinite(unitPrice);
    if (!isValid) continue;

    holdings.push({
      id: crypto.randomUUID(),
      ticker: r["종목명"],
      date: r["거래일"],
      broker: r["증권사"] ?? "",
      accountNumber: r["계좌번호"] ?? "",
      accountType: accountType as Holding["accountType"],
      assetType: assetType as Holding["assetType"],
      country: country as Holding["country"],
      tradeType: tradeType as Holding["tradeType"],
      quantity,
      unitPrice,
      buyAmount,
      sellAmount,
      appliedRate,
      distributionCycle: distributionCycle as Holding["distributionCycle"],
    });
  }
  return holdings;
}

export type NetPosition = {
  ticker: string;
  country: Holding["country"];
  accountType: Holding["accountType"];
  netQuantity: number;
  latestUnitPrice: number;
  value: number;
};

/**
 * 매수/매도 거래 원장에서 종목별 순보유수량을 집계.
 * 현재가 데이터가 없으므로 최근 거래의 unitPrice를 근사치로 사용.
 */
export function netPositions(holdings: Holding[]): NetPosition[] {
  const map = new Map<
    string,
    { qty: number; latestDate: string; latestPrice: number; h: Holding }
  >();
  for (const h of holdings) {
    const key = `${h.ticker}__${h.accountNumber}`;
    const entry = map.get(key) ?? {
      qty: 0,
      latestDate: "",
      latestPrice: h.unitPrice,
      h,
    };
    entry.qty += h.tradeType === "매도" ? -h.quantity : h.quantity;
    if (h.date >= entry.latestDate) {
      entry.latestDate = h.date;
      entry.latestPrice = h.unitPrice;
    }
    map.set(key, entry);
  }
  return [...map.entries()]
    .filter(([, v]) => v.qty > 0)
    .map(([, v]) => ({
      ticker: v.h.ticker,
      country: v.h.country,
      accountType: v.h.accountType,
      netQuantity: v.qty,
      latestUnitPrice: v.latestPrice,
      value: v.qty * v.latestPrice,
    }));
}

export type HoldingSummaryGroupBy = "account" | "ticker";

export type HoldingSummary = {
  key: string;
  ticker: string;
  accountNumber: string; // "종목별"로 여러 계좌가 합쳐지면 "-"
  accountType: string; // 합쳐진 값이 서로 다르면 "-"
  broker: string; // 합쳐진 값이 서로 다르면 "-"
  distributionCycle: string; // 합쳐진 값이 서로 다르면 "-"
  country: Holding["country"];
  netQuantity: number;
  avgUnitPrice: number; // 매수 거래 가중평균 단가 (원가 기준)
  totalBuyAmount: number; // avgUnitPrice × netQuantity, 보유통화 기준
};

/**
 * '현재 보유 종목 현황' 섹션 전용 집계.
 * groupBy="account": 종목+계좌번호 단위 (자산관리 원장의 실제 행 단위)
 * groupBy="ticker": 같은 종목을 여러 계좌에 걸쳐 1행으로 합산
 */
export function currentHoldingsSummary(
  holdings: Holding[],
  groupBy: HoldingSummaryGroupBy
): HoldingSummary[] {
  type Bucket = {
    buyQty: number;
    buyAmount: number;
    sellQty: number;
    accountNumbers: Set<string>;
    accountTypes: Set<string>;
    brokers: Set<string>;
    distributionCycles: Set<string>;
    country: Holding["country"];
    ticker: string;
  };
  const map = new Map<string, Bucket>();
  for (const h of holdings) {
    const key = groupBy === "account" ? `${h.ticker}__${h.accountNumber}` : h.ticker;
    const b = map.get(key) ?? {
      buyQty: 0,
      buyAmount: 0,
      sellQty: 0,
      accountNumbers: new Set<string>(),
      accountTypes: new Set<string>(),
      brokers: new Set<string>(),
      distributionCycles: new Set<string>(),
      country: h.country,
      ticker: h.ticker,
    };
    if (h.tradeType === "매도") {
      b.sellQty += h.quantity;
    } else {
      b.buyQty += h.quantity;
      b.buyAmount += h.unitPrice * h.quantity;
    }
    b.accountNumbers.add(h.accountNumber);
    b.accountTypes.add(h.accountType);
    b.brokers.add(h.broker);
    b.distributionCycles.add(h.distributionCycle);
    map.set(key, b);
  }

  const single = (s: Set<string>) => (s.size === 1 ? [...s][0] : "-");

  return [...map.entries()]
    .map(([key, b]) => {
      const netQuantity = b.buyQty - b.sellQty;
      const avgUnitPrice = b.buyQty > 0 ? b.buyAmount / b.buyQty : 0;
      return {
        key,
        ticker: b.ticker,
        accountNumber: single(b.accountNumbers),
        accountType: single(b.accountTypes),
        broker: single(b.brokers),
        distributionCycle: single(b.distributionCycles),
        country: b.country,
        netQuantity,
        avgUnitPrice,
        totalBuyAmount: avgUnitPrice * netQuantity,
      };
    })
    .filter((p) => p.netQuantity > 0)
    .sort((a, b) => b.totalBuyAmount - a.totalBuyAmount);
}

export function summarizeByCurrency(
  holdings: Holding[],
  cash: Cash,
  exchangeRate: ExchangeRate
) {
  const positions = netPositions(holdings);
  const krwStockValue = positions
    .filter((p) => p.country === "KOR")
    .reduce((a, p) => a + p.value, 0);
  const usdStockValue = positions
    .filter((p) => p.country === "USA")
    .reduce((a, p) => a + p.value, 0);

  const krwAssets = cash.krw + krwStockValue;
  const usdAssets = cash.usd + usdStockValue;
  const totalKrw = krwAssets + usdAssets * exchangeRate.rate;

  return { krwStockValue, usdStockValue, krwAssets, usdAssets, totalKrw, positions };
}
