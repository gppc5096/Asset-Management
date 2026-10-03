import { describe, expect, it } from "vitest";
import {
  EMPTY_ASSET_FORM,
  MSG_ASSET_INVALID_NUMBER,
  MSG_ASSET_REQUIRED,
  MSG_CASH_INVALID,
  MSG_RATE_INVALID,
  buildAssetSubmission,
  formFromHolding,
  parseCashForm,
  parseRateForm,
  type AssetFormState,
} from "@/lib/assetForm";
import { makeHolding } from "@/test/factories";

const form = (over: Partial<AssetFormState> = {}): AssetFormState => ({
  ...EMPTY_ASSET_FORM,
  ticker: "신규ETF",
  date: "2026-10-03",
  broker: "C증권",
  accountNumber: "999",
  quantity: "4",
  unitPrice: "2500",
  ...over,
});
const submit = (f: AssetFormState, over: Partial<Parameters<typeof buildAssetSubmission>[0]> = {}) =>
  buildAssetSubmission({ form: f, editingId: null, existing: [], newId: () => "new-id", ...over });

describe("buildAssetSubmission", () => {
  it("종목명·거래일·수량 누락 → MSG_ASSET_REQUIRED", () => {
    for (const bad of [{ ticker: " " }, { date: "" }, { quantity: "" }]) {
      expect(submit(form(bad))).toEqual({ ok: false, message: MSG_ASSET_REQUIRED });
    }
  });

  it("수량 0/음수/숫자 아님, 음수 단가·환율 → MSG_ASSET_INVALID_NUMBER", () => {
    for (const bad of [{ quantity: "0" }, { quantity: "-1" }, { quantity: "x" }, { unitPrice: "-5" }, { appliedRate: "-1" }, { appliedRate: "abc" }]) {
      expect(submit(form(bad))).toEqual({ ok: false, message: MSG_ASSET_INVALID_NUMBER });
    }
  });

  it("매수: buyAmount=수량×단가, sellAmount=0 / 매도: 반대", () => {
    const buy = submit(form());
    const sell = submit(form({ tradeType: "매도" }));
    if (!buy.ok || !sell.ok) throw new Error("unreachable");
    expect(buy.holdings[0]).toMatchObject({ id: "new-id", quantity: 4, unitPrice: 2500, buyAmount: 10000, sellAmount: 0, appliedRate: 0 });
    expect(sell.holdings[0]).toMatchObject({ buyAmount: 0, sellAmount: 10000 });
  });

  it("단가·환율이 비어 있으면 0", () => {
    const r = submit(form({ unitPrice: "", appliedRate: "" }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.holdings[0]).toMatchObject({ unitPrice: 0, appliedRate: 0, buyAmount: 0 });
  });

  it("추가는 끝에 붙이고(isEdit=false), 수정은 같은 id만 교체(isEdit=true)", () => {
    const a = makeHolding({ id: "a" });
    const b = makeHolding({ id: "b" });
    const added = submit(form(), { existing: [a, b] });
    if (!added.ok) throw new Error("unreachable");
    expect(added.isEdit).toBe(false);
    expect(added.holdings.map((h) => h.id)).toEqual(["a", "b", "new-id"]);
    const edited = submit(form({ ticker: "수정" }), { editingId: "a", existing: [a, b] });
    if (!edited.ok) throw new Error("unreachable");
    expect(edited.isEdit).toBe(true);
    expect(edited.holdings.map((h) => h.id)).toEqual(["a", "b"]);
    expect(edited.holdings[0].ticker).toBe("수정");
    expect(edited.holdings[1]).toBe(b);
  });
});

describe("formFromHolding", () => {
  it("보유 거래 → 폼 문자열 값", () => {
    const h = makeHolding({ ticker: "VOO", quantity: 3, unitPrice: 400, appliedRate: 1400, country: "USA" });
    expect(formFromHolding(h)).toMatchObject({ ticker: "VOO", quantity: "3", unitPrice: "400", appliedRate: "1400", country: "USA" });
  });
});

describe("parseCashForm / parseRateForm", () => {
  it("현금: 0 이상의 숫자만 허용(0 허용, 빈 값·음수·문자 거부)", () => {
    expect(parseCashForm({ krw: "0", usd: "0" })).toEqual({ ok: true, krw: 0, usd: 0 });
    expect(parseCashForm({ krw: "2500000", usd: "123.5" })).toEqual({ ok: true, krw: 2500000, usd: 123.5 });
    for (const bad of [{ krw: "", usd: "1" }, { krw: "1", usd: "" }, { krw: "-1", usd: "1" }, { krw: "a", usd: "1" }]) {
      expect(parseCashForm(bad)).toEqual({ ok: false, message: MSG_CASH_INVALID });
    }
  });

  it("환율: 0보다 큰 숫자만 허용", () => {
    expect(parseRateForm("1410.5")).toEqual({ ok: true, rate: 1410.5 });
    for (const bad of ["", "  ", "0", "-3", "abc"]) {
      expect(parseRateForm(bad)).toEqual({ ok: false, message: MSG_RATE_INVALID });
    }
  });
});
