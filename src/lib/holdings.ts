import type { Cash, ExchangeRate, Holding } from "@/lib/types";

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
