import type {
  AccountType,
  AssetType,
  Country,
  DistributionCycle,
  Holding,
  TradeType,
} from "@/lib/types";

/** 자산(보유 종목 거래) 입력 폼 상태(입력창 값은 문자열). */
export type AssetFormState = {
  ticker: string;
  date: string;
  broker: string;
  accountNumber: string;
  accountType: AccountType;
  assetType: AssetType;
  country: Country;
  tradeType: TradeType;
  quantity: string;
  unitPrice: string;
  appliedRate: string;
  distributionCycle: DistributionCycle;
};

export const EMPTY_ASSET_FORM: AssetFormState = {
  ticker: "",
  date: "",
  broker: "",
  accountNumber: "",
  accountType: "일반계좌",
  assetType: "ETF주식",
  country: "KOR",
  tradeType: "매수",
  quantity: "",
  unitPrice: "",
  appliedRate: "0",
  distributionCycle: "없음",
};

export function formFromHolding(h: Holding): AssetFormState {
  return {
    ticker: h.ticker,
    date: h.date,
    broker: h.broker,
    accountNumber: h.accountNumber,
    accountType: h.accountType,
    assetType: h.assetType,
    country: h.country,
    tradeType: h.tradeType,
    quantity: String(h.quantity),
    unitPrice: String(h.unitPrice),
    appliedRate: String(h.appliedRate),
    distributionCycle: h.distributionCycle,
  };
}

export const MSG_ASSET_REQUIRED = "종목명·거래일·수량을 입력해주세요";
export const MSG_ASSET_INVALID_NUMBER = "수량·단가·환율은 올바른 숫자여야 합니다";
export const MSG_CASH_INVALID = "KRW/USD 현금은 0 이상의 숫자여야 합니다";
export const MSG_RATE_INVALID = "적용환율은 0보다 큰 숫자여야 합니다";

export type AssetSubmission =
  | { ok: true; holdings: Holding[]; isEdit: boolean }
  | { ok: false; message: string };

/** 폼 값을 검증하고 저장할 전체 보유 거래 배열을 만든다(순수 함수). 매수/매도 금액은 수량×단가. */
export function buildAssetSubmission(params: {
  form: AssetFormState;
  editingId: string | null;
  existing: Holding[];
  newId?: () => string;
}): AssetSubmission {
  const { form, editingId, existing } = params;
  if (!form.ticker.trim() || !form.date || form.quantity.trim() === "") {
    return { ok: false, message: MSG_ASSET_REQUIRED };
  }
  const quantity = Number(form.quantity);
  const unitPrice = form.unitPrice.trim() === "" ? 0 : Number(form.unitPrice);
  const appliedRate = form.appliedRate.trim() === "" ? 0 : Number(form.appliedRate);
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(unitPrice) ||
    unitPrice < 0 ||
    !Number.isFinite(appliedRate) ||
    appliedRate < 0
  ) {
    return { ok: false, message: MSG_ASSET_INVALID_NUMBER };
  }
  const amount = quantity * unitPrice;
  const holding: Holding = {
    id: editingId ?? (params.newId ?? (() => crypto.randomUUID()))(),
    ticker: form.ticker,
    date: form.date,
    broker: form.broker,
    accountNumber: form.accountNumber,
    accountType: form.accountType,
    assetType: form.assetType,
    country: form.country,
    tradeType: form.tradeType,
    quantity,
    unitPrice,
    buyAmount: form.tradeType === "매수" ? amount : 0,
    sellAmount: form.tradeType === "매도" ? amount : 0,
    appliedRate,
    distributionCycle: form.distributionCycle,
  };
  return {
    ok: true,
    isEdit: Boolean(editingId),
    holdings: editingId
      ? existing.map((h) => (h.id === editingId ? holding : h))
      : [...existing, holding],
  };
}

export type CashSubmission = { ok: true; krw: number; usd: number } | { ok: false; message: string };

/** 현금 잔고 폼 검증: 빈 값/숫자 아님/음수는 거부. */
export function parseCashForm(form: { krw: string; usd: string }): CashSubmission {
  const krw = form.krw.trim() === "" ? NaN : Number(form.krw);
  const usd = form.usd.trim() === "" ? NaN : Number(form.usd);
  if (!Number.isFinite(krw) || krw < 0 || !Number.isFinite(usd) || usd < 0) {
    return { ok: false, message: MSG_CASH_INVALID };
  }
  return { ok: true, krw, usd };
}

export type RateSubmission = { ok: true; rate: number } | { ok: false; message: string };

/** 적용환율 폼 검증: 빈 값/숫자 아님/0 이하는 거부. */
export function parseRateForm(raw: string): RateSubmission {
  const rate = raw.trim() === "" ? NaN : Number(raw);
  if (!Number.isFinite(rate) || rate <= 0) {
    return { ok: false, message: MSG_RATE_INVALID };
  }
  return { ok: true, rate };
}
