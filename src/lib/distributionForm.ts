import { calcDistributionChange, calcPriceChange, computeDistributionAmounts } from "@/lib/tax";
import type { DistributionCategory, DistributionRecord } from "@/lib/types";

/** 분배금 기록 입력 폼 상태(입력창 값은 모두 문자열). */
export type RecordFormState = {
  ticker: string;
  date: string;
  quantity: string;
  price: string;
  distribution: string;
  taxBase: string;
  held: boolean;
};

export const EMPTY_RECORD_FORM: RecordFormState = {
  ticker: "",
  date: "",
  quantity: "",
  price: "",
  distribution: "",
  taxBase: "",
  held: true,
};

export function formFromRecord(record: DistributionRecord): RecordFormState {
  return {
    ticker: record.ticker,
    date: record.date,
    quantity: String(record.quantity),
    price: String(record.price),
    distribution: String(record.distribution),
    taxBase: String(record.taxBase),
    held: record.held,
  };
}

export const MSG_REQUIRED = "종목명·거래일·수량을 입력해주세요";
export const MSG_INVALID_NUMBER = "수량·현주가·분배금은 올바른 숫자여야 합니다";

export type RecordSubmission =
  | { ok: true; records: DistributionRecord[]; isEdit: boolean }
  | { ok: false; message: string };

/**
 * 폼 값을 검증하고, 저장할 전체 기록 배열을 만든다(순수 함수).
 * - 수정이면 같은 id의 기록을 교체, 추가면 새 id로 끝에 붙임
 * - 계좌 유형에 맞는 세금/합계를 재계산하고, 전달 대비 등락을 채움
 */
export function buildRecordSubmission(params: {
  form: RecordFormState;
  category: DistributionCategory;
  editingId: string | null;
  existing: DistributionRecord[];
  newId?: () => string;
}): RecordSubmission {
  const { form, category, editingId, existing } = params;
  if (!form.ticker.trim() || !form.date || form.quantity.trim() === "") {
    return { ok: false, message: MSG_REQUIRED };
  }
  const quantity = Number(form.quantity);
  const price = form.price.trim() === "" ? 0 : Number(form.price);
  const distribution = form.distribution.trim() === "" ? 0 : Number(form.distribution);
  const taxBase = form.taxBase.trim() === "" ? 0 : Number(form.taxBase);
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isFinite(distribution) ||
    distribution < 0 ||
    !Number.isFinite(taxBase) ||
    taxBase < 0
  ) {
    return { ok: false, message: MSG_INVALID_NUMBER };
  }
  const amounts = computeDistributionAmounts({ quantity, distribution, taxBase }, category);
  const recordId = editingId ?? (params.newId ?? (() => crypto.randomUUID()))();
  const draft: DistributionRecord = {
    id: recordId,
    ticker: form.ticker,
    date: form.date,
    quantity,
    price,
    distribution,
    held: form.held,
    priceChange: 0,
    distributionChange: 0,
    ...amounts,
    taxBase,
  };
  const nextRecords = editingId
    ? existing.map((r) => (r.id === editingId ? draft : r))
    : [...existing, draft];
  const record: DistributionRecord = {
    ...draft,
    priceChange: calcPriceChange(draft, nextRecords),
    distributionChange: calcDistributionChange(draft, nextRecords),
  };
  return {
    ok: true,
    isEdit: Boolean(editingId),
    records: nextRecords.map((r) => (r.id === record.id ? record : r)),
  };
}
