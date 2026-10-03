import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DistributionAccountView } from "@/components/distribution/DistributionAccountView";
import { computeDistributionAmounts } from "@/lib/tax";
import type { DistributionCategory, DistributionDoc, DistributionRecord } from "@/lib/types";
import { firestoreModule, firestoreState } from "@/test/firebaseMock";
import { toastMock } from "@/test/toastMock";
import { domText } from "@/test/dom";
import { MSG_BACKUP_FAILED, MSG_RESTORE_FAILED, MSG_RESTORE_LOOKUP_FAILED, MSG_SAVE_FAILED } from "@/lib/runSafely";

/**
 * 리팩토링 안전망(특성 테스트): 화면 출력과 저장 동작을 고정한다.
 * 오늘 날짜는 2026-10-03(KST)로 고정.
 */
const PH = "기존 종목 선택 또는 새 종목명 직접 입력";

function rec(
  id: string,
  ticker: string,
  date: string,
  quantity: number,
  price: number,
  distribution: number,
  taxBase: number,
  held = true,
  category: DistributionCategory = "general"
): DistributionRecord {
  return {
    id, ticker, date, quantity, price, distribution, taxBase, held,
    priceChange: 0, distributionChange: 0,
    ...computeDistributionAmounts({ quantity, distribution, taxBase }, category),
  };
}

// A 2건, B(마지막 기록은 매도) 2건, C 1건, F 8건 = 13건 (더보기 페이지네이션 확인용)
const RECORDS: DistributionRecord[] = [
  rec("a1", "A", "2026-08-10", 100, 1000, 10, 10),
  rec("a2", "A", "2026-09-10", 100, 1100, 12, 12),
  rec("b1", "B", "2026-09-05", 50, 2000, 20, 0),
  rec("b2", "B", "2026-10-02", 50, 2100, 0, 0, false),
  rec("c1", "C", "2026-10-01", 200, 500, 5, 5),
  ...Array.from({ length: 8 }, (_, i) =>
    rec(`f${i + 1}`, "F", `2026-0${i + 1}-15`, 10, 100, 1, 1)
  ),
];

const docPath = (category: DistributionCategory) => `users/u1/backups/${category}`;
function seed(category: DistributionCategory, records = RECORDS) {
  const doc: DistributionDoc = { records, updatedAt: "2026-10-02T00:00:00.000Z" };
  firestoreState.docs.set(docPath(category), doc);
}
function renderView(category: DistributionCategory = "general") {
  const titles = { general: "일반계좌 분배금 현황", special: "특별계좌 분배금 현황", "tax-free": "비과세계좌 분배금 현황" };
  return render(<DistributionAccountView category={category} title={titles[category]} subtitle="부제" />);
}
/** 마지막 setDoc 호출의 (경로, 저장 데이터) */
function lastSave() {
  const calls = firestoreModule.setDoc.mock.calls as unknown as [{ path: string }, DistributionDoc][];
  const [ref, data] = calls[calls.length - 1];
  return { path: ref.path, data };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-03T12:00:00+09:00") });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DistributionAccountView — 화면 출력 고정", () => {
  it("기본 화면 전체(요약 카드·표·차트 입력 데이터) 스냅샷", async () => {
    seed("general");
    const { container } = renderView("general");
    await expect(domText(container)).toMatchFileSnapshot("./__snapshots__/general-default.html");
  });

  it("추가 다이얼로그가 열린 화면 스냅샷(종목 추천 목록 포함)", async () => {
    seed("general");
    renderView("general");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /자산 추가/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByPlaceholderText(PH));
    await expect(domText(dialog)).toMatchFileSnapshot("./__snapshots__/general-add-dialog.html");
  });

  it("요약 카드: 종목별 최신 기록 중 보유중인 종목만 수량 합계/가중평균, 분배금 합계는 전체", () => {
    seed("general");
    renderView();
    // A(100주@1100) + C(200주@500) + F(10주@100); B는 최신 기록이 '매도'라 제외
    expect(screen.getByText("310 주")).toBeTruthy();
    expect(screen.getByText("681 원")).toBeTruthy(); // round(211000/310)
    // 분배금총액 합: A 1,000+1,200 / B 1,000+0 / C 1,000 / F 80
    expect(screen.getByText("₩4,280")).toBeTruthy();
  });

  it("표: 최신 거래일 순, 처음 10건만 보이고 '더보기'로 나머지 표시", async () => {
    seed("general");
    renderView();
    const user = userEvent.setup();
    const rows = () => screen.getAllByRole("row").slice(1); // 헤더 제외
    expect(rows()).toHaveLength(10);
    expect(within(rows()[0]).getByText("2026-10-02")).toBeTruthy();
    expect(within(rows()[0]).getByText("매도")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /더보기 \(10 \/ 13\)/ }));
    expect(rows()).toHaveLength(13);
    expect(screen.queryByRole("button", { name: /더보기/ })).toBeNull();
  });

  it("주가·분배금 등락: 동일 종목 전달 최신 기록 대비(+/−) 표시", () => {
    seed("general");
    renderView();
    const sep = screen.getAllByRole("row").find((r) => within(r).queryByText("2026-09-10"))!;
    expect(within(sep).getByText("+100")).toBeTruthy(); // 1100-1000
    expect(within(sep).getByText("+2")).toBeTruthy(); // 12-10
    const oct = screen.getAllByRole("row").find((r) => within(r).queryByText("2026-10-02"))!;
    expect(within(oct).getByText("-20")).toBeTruthy(); // 분배금 0 - 20
  });

  it("종목 검색: 대소문자 무시, 필터 후 표/요약 갱신 및 더보기 초기화", async () => {
    seed("general");
    renderView();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("자산 검색 (종목명)"), "a");
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(2);
    expect(screen.queryByText("200 주")).toBeNull();
    expect(screen.getByText("100 주")).toBeTruthy();
    expect(screen.getByText("₩2,200")).toBeTruthy();
  });

  it("데이터가 없으면 '데이터가 없습니다'", () => {
    seed("general", []);
    renderView();
    expect(screen.getByText("데이터가 없습니다")).toBeTruthy();
  });

  it.each(["special", "general", "tax-free"] as const)("%s: 계좌 유형별 문서(경로)를 구독한다", (category) => {
    seed(category);
    renderView(category);
    const subscribed = (firestoreModule.onSnapshot.mock.calls as unknown as [{ path: string }][]).map((c) => c[0].path);
    expect(subscribed).toContain(docPath(category));
  });
});

describe("DistributionAccountView — 저장 동작 고정", () => {
  async function openAddDialog() {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /자산 추가/ }));
    const dialog = await screen.findByRole("dialog");
    return { user, dialog };
  }

  it("추가: 일반계좌 세금(15.4%)이 반영된 레코드를 해당 계좌 문서에 저장하고 알림을 띄운다", async () => {
    seed("general");
    renderView("general");
    const { user, dialog } = await openAddDialog();
    const num = within(dialog).getAllByRole("spinbutton"); // 수량, 현주가, 주당 분배금, 주당 과세대상 분배금
    await user.type(within(dialog).getByPlaceholderText(PH), "신규");
    await user.type(num[0], "10");
    await user.type(num[1], "1000");
    await user.type(num[2], "50");
    await user.type(num[3], "40");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    const { path, data } = lastSave();
    expect(path).toBe(docPath("general"));
    expect(data.records).toHaveLength(RECORDS.length + 1);
    const added = data.records.find((r) => r.ticker === "신규")!;
    expect(added).toMatchObject({
      date: "2026-10-03", quantity: 10, price: 1000, distribution: 50, taxBase: 40, held: true,
      distributionReceived: 500, taxedDistribution: 400, taxAmount: 62, total: 438,
      priceChange: 0, distributionChange: 0,
    });
    expect(typeof added.id).toBe("string");
    expect(toastMock.success).toHaveBeenCalledWith("추가되었습니다");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("추가: 비과세계좌는 세금 0", async () => {
    seed("tax-free", RECORDS.map((r) => ({ ...r })));
    renderView("tax-free");
    const { user, dialog } = await openAddDialog();
    const num = within(dialog).getAllByRole("spinbutton");
    await user.type(within(dialog).getByPlaceholderText(PH), "TF");
    await user.type(num[0], "10");
    await user.type(num[2], "50");
    await user.type(num[3], "40");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    const added = lastSave().data.records.find((r) => r.ticker === "TF")!;
    expect(added.taxAmount).toBe(0);
    expect(added.total).toBe(500);
  });

  it("추가: 같은 종목의 전달 기록이 있으면 등락을 계산해 저장", async () => {
    seed("general");
    renderView("general");
    const { user, dialog } = await openAddDialog();
    const num = within(dialog).getAllByRole("spinbutton");
    await user.type(within(dialog).getByPlaceholderText(PH), "C");
    await user.type(num[0], "200");
    await user.type(num[1], "550");
    await user.type(num[2], "7");
    const date = dialog.querySelector('input[type="date"]') as HTMLInputElement;
    await user.clear(date);
    await user.type(date, "2026-11-05");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    const added = lastSave().data.records.find((r) => r.date === "2026-11-05")!;
    expect(added.priceChange).toBe(50); // 550 - 500 (10월 C)
    expect(added.distributionChange).toBe(2); // 7 - 5
  });

  it("추가: 종목명·거래일·수량 누락, 수량 0/숫자 아님은 저장하지 않고 오류 알림", async () => {
    seed("general");
    renderView("general");
    const { user, dialog } = await openAddDialog();
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(toastMock.error).toHaveBeenLastCalledWith("종목명·거래일·수량을 입력해주세요");
    await user.type(within(dialog).getByPlaceholderText(PH), "X");
    await user.type(within(dialog).getAllByRole("spinbutton")[0], "0");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(toastMock.error).toHaveBeenLastCalledWith("수량·현주가·분배금은 올바른 숫자여야 합니다");
    expect(firestoreModule.setDoc).not.toHaveBeenCalled();
  });

  it("수정: 같은 id의 레코드만 교체하고 나머지는 그대로", async () => {
    seed("general");
    renderView("general");
    const user = userEvent.setup();
    const row = screen.getAllByRole("row").find((r) => within(r).queryByText("2026-09-10"))!;
    await user.click(within(row).getAllByRole("button")[0]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("자산 수정")).toBeTruthy();
    const qty = within(dialog).getAllByRole("spinbutton")[0];
    await user.clear(qty);
    await user.type(qty, "150");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    const { data } = lastSave();
    expect(data.records).toHaveLength(RECORDS.length);
    const edited = data.records.find((r) => r.id === "a2")!;
    expect(edited.quantity).toBe(150);
    expect(edited.distributionReceived).toBe(150 * 12);
    expect(data.records.find((r) => r.id === "a1")).toEqual(RECORDS.find((r) => r.id === "a1"));
    expect(toastMock.success).toHaveBeenCalledWith("수정되었습니다");
  });

  it("삭제: 공통 확인 다이얼로그에서 승인할 때만 해당 레코드를 제거해 저장(브라우저 confirm 미사용)", async () => {
    seed("general");
    renderView("general");
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm");
    const target = () => screen.getAllByRole("row").find((r) => within(r).queryByText("2026-09-10"))!;

    await user.click(within(target()).getAllByRole("button")[1]);
    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("항목 삭제")).toBeTruthy();
    expect(within(dialog).getByText(/A · 2026-09-10/)).toBeTruthy(); // 무엇을 지우는지 표시
    await user.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(firestoreModule.setDoc).not.toHaveBeenCalled();

    await user.click(within(target()).getAllByRole("button")[1]);
    dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "삭제" }));
    expect(lastSave().data.records.map((r) => r.id)).not.toContain("a2");
    expect(lastSave().data.records).toHaveLength(RECORDS.length - 1);
    expect(toastMock.success).toHaveBeenCalledWith("삭제되었습니다");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("초기화: 확인 다이얼로그에서 확정하면 records를 비워 저장", async () => {
    seed("general");
    renderView("general");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /초기화/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("전체 데이터 초기화")).toBeTruthy();
    expect(within(dialog).getByText(/일반계좌 분배금 현황의 모든 분배금 기록이 삭제됩니다/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "초기화" }));
    expect(lastSave().data.records).toEqual([]);
    expect(toastMock.success).toHaveBeenCalledWith("초기화되었습니다");
  });

  it("클라우드 백업: backups/<계좌>-backup-<시각> 문서로 현재 데이터를 저장", async () => {
    seed("general");
    renderView("general");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /클라우드 백업/ }));
    const { path, data } = lastSave();
    expect(path).toMatch(/^users\/u1\/backups\/general-backup-2026-10-03T/);
    expect(data.records).toHaveLength(RECORDS.length);
    expect(toastMock.success).toHaveBeenCalledWith("클라우드에 백업되었습니다", expect.anything());
  });

  it("클라우드 복원: 가장 최근 백업을 확인 후 본 문서로 덮어쓴다", async () => {
    seed("general");
    const older: DistributionDoc = { records: [RECORDS[0]], updatedAt: "x" };
    const newer: DistributionDoc = { records: RECORDS.slice(0, 3), updatedAt: "y" };
    firestoreModule.getDocs.mockResolvedValue({
      docs: [
        { id: "general-backup-2026-09-01T00:00:00.000Z", data: () => older },
        { id: "special-backup-2026-10-01T00:00:00.000Z", data: () => ({ records: [] }) }, // 다른 계좌 → 무시
        { id: "general-backup-2026-10-01T00:00:00.000Z", data: () => newer },
      ],
    });
    renderView("general");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /클라우드 복원/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/general-backup-2026-10-01T00:00:00.000Z/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "복원" }));
    const { path, data } = lastSave();
    expect(path).toBe(docPath("general"));
    expect(data.records).toHaveLength(3);
    expect(toastMock.success).toHaveBeenCalledWith("복원되었습니다", expect.anything());
    expect(screen.queryByRole("dialog")).toBeNull(); // 성공하면 확인 다이얼로그가 닫힌다
  });

  it("클라우드 복원 저장 실패: 오류 알림, 확인 다이얼로그 유지 → 재시도하면 복원", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    seed("general");
    firestoreModule.getDocs.mockResolvedValue({
      docs: [{ id: "general-backup-2026-10-01T00:00:00.000Z", data: () => ({ records: [RECORDS[0]], updatedAt: "y" }) }],
    });
    renderView("general");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /클라우드 복원/ }));
    const dialog = await screen.findByRole("dialog");
    firestoreModule.setDoc.mockRejectedValueOnce(new Error("network"));
    await user.click(within(dialog).getByRole("button", { name: "복원" }));
    expect(toastMock.error).toHaveBeenLastCalledWith(MSG_RESTORE_FAILED);
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "복원" }));
    expect(toastMock.success).toHaveBeenCalledWith("복원되었습니다", expect.anything());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("클라우드 복원: 백업이 없거나 형식이 틀리면 오류 알림만 띄운다", async () => {
    seed("general");
    renderView("general");
    const user = userEvent.setup();
    firestoreModule.getDocs.mockResolvedValueOnce({ docs: [] });
    await user.click(screen.getByRole("button", { name: /클라우드 복원/ }));
    expect(toastMock.error).toHaveBeenLastCalledWith("복원할 백업이 없습니다");
    firestoreModule.getDocs.mockResolvedValueOnce({
      docs: [{ id: "general-backup-2026-10-01T00:00:00.000Z", data: () => ({ nope: true }) }],
    });
    await user.click(screen.getByRole("button", { name: /클라우드 복원/ }));
    expect(toastMock.error).toHaveBeenLastCalledWith("백업 데이터 형식이 올바르지 않습니다");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(firestoreModule.setDoc).not.toHaveBeenCalled();
  });

  it("내보내기: <날짜>-<계좌>_내보내기.csv 이름으로 CSV를 내려받는다", async () => {
    seed("general");
    renderView("general");
    const user = userEvent.setup();
    const createUrl = vi.fn(() => "blob:mock");
    vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    await user.click(screen.getByRole("button", { name: /내보내기/ }));
    expect(names).toEqual(["2026-10-03-일반계좌_내보내기.csv"]);
    const blob = (createUrl.mock.calls as unknown as [Blob][])[0][0];
    expect(blob.type).toBe("text/csv;charset=utf-8");
    expect(await blob.text()).toContain("거래일,종목명,주식수량,현주가,분배금,과세표준,보유여부");
  });
});

describe("DistributionAccountView — 안정성(저장 실패·읽기 오류)", () => {
  async function fillAndOpen() {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /자산 추가/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText(PH), "신규");
    await user.type(within(dialog).getAllByRole("spinbutton")[0], "10");
    return { user, dialog };
  }

  it("저장 실패(추가): 오류 알림만 띄우고 성공 알림 없음, 입력 다이얼로그는 열린 채 유지", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    seed("general");
    renderView("general");
    firestoreModule.setDoc.mockRejectedValue(new Error("network"));
    const { user, dialog } = await fillAndOpen();
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(toastMock.error).toHaveBeenLastCalledWith(MSG_SAVE_FAILED);
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    // 재시도하면 성공 경로로 이어진다
    firestoreModule.setDoc.mockResolvedValue(undefined);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "저장" }));
    expect(toastMock.success).toHaveBeenCalledWith("추가되었습니다");
  });

  it("저장 실패(삭제): 오류 알림, 성공 알림 없음, 확인 다이얼로그 유지", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    seed("general");
    renderView("general");
    firestoreModule.setDoc.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    const row = screen.getAllByRole("row").find((r) => within(r).queryByText("2026-09-10"))!;
    await user.click(within(row).getAllByRole("button")[1]);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "삭제" }));
    expect(toastMock.error).toHaveBeenLastCalledWith(MSG_SAVE_FAILED);
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("저장 실패(초기화): 오류 알림, 확인 다이얼로그는 닫히지 않음", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    seed("general");
    renderView("general");
    firestoreModule.setDoc.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /초기화/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "초기화" }));
    expect(toastMock.error).toHaveBeenLastCalledWith(MSG_SAVE_FAILED);
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("클라우드 백업 실패 / 복원 목록 조회 실패: 각각 전용 오류 알림", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    seed("general");
    renderView("general");
    const user = userEvent.setup();
    firestoreModule.setDoc.mockRejectedValue(new Error("network"));
    await user.click(screen.getByRole("button", { name: /클라우드 백업/ }));
    expect(toastMock.error).toHaveBeenLastCalledWith(MSG_BACKUP_FAILED);
    firestoreModule.getDocs.mockRejectedValue(new Error("network"));
    await user.click(screen.getByRole("button", { name: /클라우드 복원/ }));
    expect(toastMock.error).toHaveBeenLastCalledWith(MSG_RESTORE_LOOKUP_FAILED);
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("읽기 오류: 경고 배너가 보이고 쓰기 버튼이 잠기며, 저장 시도는 막힌다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    seed("general");
    firestoreState.listenError = true;
    renderView("general");
    expect(screen.getByRole("alert").textContent).toMatch(/불러오지 못해 편집이 잠겨 있습니다/);
    for (const name of [/가져오기/, /클라우드 백업/, /클라우드 복원/, /초기화/, /자산 추가/]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(firestoreModule.setDoc).not.toHaveBeenCalled();
  });

  it("정상일 때는 경고 배너가 없다", () => {
    seed("general");
    renderView("general");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
