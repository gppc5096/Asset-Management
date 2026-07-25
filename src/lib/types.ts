export const ACCOUNT_TYPES = [
  "일반계좌",
  "특별계좌",
  "비과세저축계좌",
  "ISA",
  "연금저축계좌",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ASSET_TYPES = ["개별주식", "ETF주식"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const COUNTRIES = ["KOR", "USA"] as const;
export type Country = (typeof COUNTRIES)[number];

export const TRADE_TYPES = ["매수", "매도"] as const;
export type TradeType = (typeof TRADE_TYPES)[number];

export const DISTRIBUTION_CYCLES = ["없음", "월초", "월중", "월말", "분기"] as const;
export type DistributionCycle = (typeof DISTRIBUTION_CYCLES)[number];

export type Holding = {
  id: string;
  ticker: string;
  date: string;
  broker: string;
  accountNumber: string;
  accountType: AccountType;
  assetType: AssetType;
  country: Country;
  tradeType: TradeType;
  quantity: number;
  unitPrice: number;
  buyAmount: number;
  sellAmount: number;
  appliedRate: number;
  distributionCycle: DistributionCycle;
};

export type Cash = {
  krw: number;
  usd: number;
  updatedAt: string;
};

export type ExchangeRate = {
  rate: number;
  source: string;
  fetchedAt: string;
};

export type AssetConfig = {
  holdings: Holding[];
  cash: Cash;
  exchangeRate: ExchangeRate;
  updatedAt: string;
};

export type DistributionRecord = {
  id: string;
  ticker: string;
  date: string;
  quantity: number;
  price: number;
  distribution: number;
  distributionReceived: number;
  taxBase: number;
  taxAmount: number;
  taxedDistribution: number;
  total: number;
  held: boolean;
  priceChange: number;
  distributionChange: number;
};

export type DistributionCategory = "general" | "special" | "tax-free";

export type DistributionDoc = {
  records: DistributionRecord[];
  updatedAt: string;
};
