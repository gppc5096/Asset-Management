import type { NetPosition } from "@/lib/holdings";
import type { AccountType, Country, Holding } from "@/lib/types";

/**
 * 자산관리 화면의 파생 데이터 계산(순수 함수).
 * AssetConfigView에서 분리 — 화면 없이 단위 테스트할 수 있다.
 */

export type HoldingFilter = { accountType: string; broker: string; search: string };

/** 증권사 필터 옵션: 비어 있지 않은 증권사 이름(등장 순서). */
export function listBrokers(holdings: Holding[]): string[] {
  return [...new Set(holdings.map((h) => h.broker))].filter(Boolean);
}

/** 자산 추가 모달 — 국가에 속한 증권사 옵션. */
export function brokerOptionsForCountry(holdings: Holding[], country: Country): string[] {
  return [...new Set(holdings.filter((h) => h.country === country).map((h) => h.broker))].filter(
    Boolean
  );
}

/** 자산 추가 모달 — 국가(+증권사) 조건에 맞는 종목명 옵션. */
export function tickerOptionsFor(holdings: Holding[], country: Country, broker: string): string[] {
  return [
    ...new Set(
      holdings
        .filter((h) => h.country === country && (!broker || h.broker === broker))
        .map((h) => h.ticker)
    ),
  ].filter(Boolean);
}

/** 자산 추가 모달 — 국가(+증권사) 조건에 맞는 계좌번호 옵션. */
export function accountNumberOptionsFor(
  holdings: Holding[],
  country: Country,
  broker: string
): string[] {
  return [
    ...new Set(
      holdings
        .filter((h) => h.country === country && (!broker || h.broker === broker))
        .map((h) => h.accountNumber)
    ),
  ].filter(Boolean);
}

/** 계좌번호 → 계좌유형 매핑 (같은 계좌는 항상 같은 계좌유형이라는 전제, 나중 항목이 우선). */
export function accountTypeMap(holdings: Holding[]): Map<string, AccountType> {
  const map = new Map<string, AccountType>();
  for (const h of holdings) map.set(h.accountNumber, h.accountType);
  return map;
}

/** 계좌유형·증권사("전체"=제한 없음)·종목 검색어로 거르고 최신 거래일 순 정렬. */
export function filterHoldings(
  holdings: Holding[],
  { accountType, broker, search }: HoldingFilter
): Holding[] {
  return holdings
    .filter((h) => {
      if (accountType !== "전체" && h.accountType !== accountType) return false;
      if (broker !== "전체" && h.broker !== broker) return false;
      if (search && !h.ticker.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** 통화별 자산 구성(KRW/USD 환산) 파이차트 데이터. */
export function currencyPieData(summary: { krwAssets: number; usdAssetsKrw: number }) {
  return [
    { name: "KRW 자산", value: summary.krwAssets },
    { name: "USD 자산 (KRW환산)", value: summary.usdAssetsKrw },
  ];
}

/** 계좌유형별 투자 비중(평가금액 합). */
export function accountTypePieData(positions: NetPosition[]) {
  const map = new Map<string, number>();
  for (const p of positions) {
    map.set(p.accountType, (map.get(p.accountType) ?? 0) + p.value);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value }));
}

/** 통화별(KOR=krw, 그 외=usd) 종목 보유수량 합. */
export function tickerShareByCountry(positions: NetPosition[]) {
  const krw: Record<string, number> = {};
  const usd: Record<string, number> = {};
  for (const p of positions) {
    const target = p.country === "KOR" ? krw : usd;
    target[p.ticker] = (target[p.ticker] ?? 0) + p.netQuantity;
  }
  return { krw, usd };
}
