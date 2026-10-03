import { describe, expect, it } from "vitest";
import {
  EMPTY_RECORD_FORM,
  MSG_INVALID_NUMBER,
  MSG_REQUIRED,
  buildRecordSubmission,
  formFromRecord,
  type RecordFormState,
} from "@/lib/distributionForm";
import { makeRecord } from "@/test/factories";

const form = (over: Partial<RecordFormState> = {}): RecordFormState => ({
  ...EMPTY_RECORD_FORM,
  ticker: "신규",
  date: "2026-10-03",
  quantity: "10",
  price: "1000",
  distribution: "50",
  taxBase: "40",
  ...over,
});
const submit = (f: RecordFormState, over: Partial<Parameters<typeof buildRecordSubmission>[0]> = {}) =>
  buildRecordSubmission({ form: f, category: "general", editingId: null, existing: [], newId: () => "new-id", ...over });

describe("buildRecordSubmission — 검증", () => {
  it("종목명·거래일·수량이 비면 MSG_REQUIRED", () => {
    for (const bad of [{ ticker: "  " }, { date: "" }, { quantity: "" }, { quantity: "   " }]) {
      expect(submit(form(bad))).toEqual({ ok: false, message: MSG_REQUIRED });
    }
  });

  it("수량 0/음수/숫자 아님, 음수 현주가·분배금·과세표준은 MSG_INVALID_NUMBER", () => {
    for (const bad of [{ quantity: "0" }, { quantity: "-1" }, { quantity: "abc" }, { price: "-1" }, { distribution: "-1" }, { taxBase: "-1" }, { price: "x" }]) {
      expect(submit(form(bad))).toEqual({ ok: false, message: MSG_INVALID_NUMBER });
    }
  });

  it("현주가·분배금·과세표준이 비어 있으면 0으로 처리", () => {
    const r = submit(form({ price: "", distribution: "", taxBase: "" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.records[0]).toMatchObject({ price: 0, distribution: 0, taxBase: 0, total: 0 });
  });
});

describe("buildRecordSubmission — 추가/수정", () => {
  it("추가: 새 id로 끝에 붙이고 계좌 유형에 맞게 세금 계산", () => {
    const r = submit(form());
    expect(r.ok && r.isEdit).toBe(false);
    if (!r.ok) throw new Error("unreachable");
    expect(r.records).toHaveLength(1);
    expect(r.records[0]).toMatchObject({
      id: "new-id", ticker: "신규", quantity: 10, price: 1000, distribution: 50, taxBase: 40, held: true,
      distributionReceived: 500, taxedDistribution: 400, taxAmount: 62, total: 438,
    });
    const taxFree = submit(form(), { category: "tax-free" });
    if (!taxFree.ok) throw new Error("unreachable");
    expect(taxFree.records[0]).toMatchObject({ taxAmount: 0, total: 500 });
  });

  it("추가: 전달 기록이 있으면 등락을 채운다", () => {
    const prev = makeRecord({ id: "p", ticker: "신규", date: "2026-09-20", price: 900, distribution: 40 });
    const r = submit(form(), { existing: [prev] });
    if (!r.ok) throw new Error("unreachable");
    const added = r.records.find((x) => x.id === "new-id")!;
    expect(added).toMatchObject({ priceChange: 100, distributionChange: 10 });
    expect(r.records[0]).toBe(prev); // 기존 기록은 그대로(참조 유지)
  });

  it("수정: 같은 id만 교체하고 새 id를 만들지 않는다", () => {
    const a = makeRecord({ id: "a", ticker: "A" });
    const b = makeRecord({ id: "b", ticker: "B" });
    const r = submit(form({ ticker: "A2" }), { editingId: "a", existing: [a, b] });
    if (!r.ok) throw new Error("unreachable");
    expect(r.isEdit).toBe(true);
    expect(r.records.map((x) => x.id)).toEqual(["a", "b"]);
    expect(r.records[0].ticker).toBe("A2");
    expect(r.records[1]).toBe(b);
  });
});

describe("formFromRecord", () => {
  it("기록 → 폼 문자열 값", () => {
    const rec = makeRecord({ ticker: "A", date: "2026-09-10", quantity: 150, price: 1100, distribution: 12, taxBase: 10, held: false });
    expect(formFromRecord(rec)).toEqual({
      ticker: "A", date: "2026-09-10", quantity: "150", price: "1100", distribution: "12", taxBase: "10", held: false,
    });
  });
});
