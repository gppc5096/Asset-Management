export type AccountType =
  | "일반계좌"
  | "특별계좌"
  | "비과세저축계좌"
  | "ISA"
  | "연금저축계좌";

export type AssetType = "개별주식" | "ETF주식";
export type Country = "KOR" | "USA";
export type TradeType = "매수" | "매도";
export type DistributionCycle = "없음" | "월초" | "월중" | "월말" | "분기";

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
