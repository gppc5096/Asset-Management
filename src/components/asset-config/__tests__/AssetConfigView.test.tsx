import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssetConfigView } from "@/components/asset-config/AssetConfigView";
import { AssetConfigProvider } from "@/components/providers/AssetConfigProvider";
import type { AssetConfig, Holding } from "@/lib/types";
import { firestoreModule, firestoreState } from "@/test/firebaseMock";
import { toastMock } from "@/test/toastMock";
import { domText } from "@/test/dom";
import { makeHolding } from "@/test/factories";
import { MSG_SAVE_FAILED } from "@/lib/runSafely";
import { MSG_RATE_FETCH_FAILED } from "@/lib/exchangeRate";

/**
 * 리팩토링 안전망(특성 테스트): 자산관리 화면의 출력과 저장 동작을 고정한다.
 * 오늘 날짜는 2026-10-03(KST)로 고정.
 */
const DOC_PATH = "users/u1/backups/asset-config";

const HOLDINGS: Holding[] = [
  makeHolding({ id: "h1", ticker: "삼성", country: "KOR", date: "2026-08-01", broker: "A증권", accountNumber: "111", accountType: "일반계좌", quantity: 10, unitPrice: 70000, buyAmount: 700000, distributionCycle: "월말" }),
  makeHolding({ id: "h2", ticker: "삼성", country: "KOR", date: "2026-09-01", broker: "A증권", accountNumber: "111", accountType: "일반계좌", tradeType: "매도", quantity: 5, unitPrice: 80000, sellAmount: 400000, distributionCycle: "월말" }),
  makeHolding({ id: "h3", ticker: "VOO", country: "USA", date: "2026-08-02", broker: "B증권", accountNumber: "222", accountType: "ISA", assetType: "ETF주식", quantity: 3, unitPrice: 400, buyAmount: 1200, appliedRate: 1400, distributionCycle: "분기" }),
  makeHolding({ id: "h4", ticker: "VOO", country: "USA", date: "2026-09-10", broker: "B증권", accountNumber: "222", accountType: "ISA", assetType: "ETF주식", quantity: 2, unitPrice: 450, buyAmount: 900, appliedRate: 1400, distributionCycle: "분기" }),
];

function config(over: Partial<AssetConfig> = {}): AssetConfig {
  return {
    holdings: HOLDINGS,
    cash: { krw: 1_000_000, usd: 500, updatedAt: "2026-09-24T00:00:00.000Z" },
    exchangeRate: { rate: 1400, source: "manual", fetchedAt: "2026-09-24T00:00:00.000Z" },
    updatedAt: "2026-09-24T00:00:00.000Z",
    ...over,
  };
}
const seed = (c: AssetConfig = config()) => firestoreState.docs.set(DOC_PATH, c);
const renderView = () =>
  render(
    <AssetConfigProvider>
      <AssetConfigView />
    </AssetConfigProvider>
  );
function lastSave() {
  const calls = firestoreModule.setDoc.mock.calls as unknown as [{ path: string }, AssetConfig][];
  const [ref, data] = calls[calls.length - 1];
  return { path: ref.path, data };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-03T12:00:00+09:00") });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AssetConfigView — 화면 출력 고정", () => {
  it("기본 화면 전체 스냅샷(요약 카드·표·차트 입력 데이터)", async () => {
    seed();
    const { container } = renderView();
    await expect(domText(container)).toMatchFileSnapshot("./__snapshots__/default.html");
  });

  it("요약 카드: 총자산·USD 자산·KRW 자산을 순보유수량×최근단가와 현금·환율로 계산", () => {
    seed();
    renderView();
    // KRW: 삼성 순5주 × 최근단가 80,000 = 400,000 + 현금 1,000,000 = 1,400,000
    // USD: VOO 순5주 × 최근단가 450 = 2,250 + 현금 500 = 2,750 → ×1,400 = 3,850,000
    expect(screen.getByText("₩5,250,000")).toBeTruthy();
    expect(screen.getByText(/적용환율 \(USD\/KRW\)\s*₩1,400/)).toBeTruthy();
    expect(screen.getByText(/KRW ₩1,400,000 \+ USD환산 ₩3,850,000/)).toBeTruthy();
    expect(screen.getByText("$2,750")).toBeTruthy();
    expect(screen.getByText(/주식 \$2,250 \+ 현금 \$\s*500/)).toBeTruthy();
    expect(screen.getByText("₩1,400,000", { selector: "p.text-red-600" })).toBeTruthy();
    expect(screen.getByText(/주식 ₩400,000 \+ 현금 ₩1,000,000/)).toBeTruthy();
  });

  it("저장 환율 0이어도 USA 종목 적용환율(1,400)로 폴백해 총자산을 계산", () => {
    seed(config({ exchangeRate: { rate: 0, source: "auto", fetchedAt: new Date(0).toISOString() } }));
    renderView();
    expect(screen.getByText("₩5,250,000")).toBeTruthy();
  });

  it("환율 근거가 전혀 없으면 '미설정 · 연필로 입력'과 USD 제외 총자산", () => {
    seed(
      config({
        holdings: HOLDINGS.map((h) => ({ ...h, appliedRate: 0 })),
        exchangeRate: { rate: 0, source: "auto", fetchedAt: new Date(0).toISOString() },
      })
    );
    renderView();
    expect(screen.getByText(/미설정 · 연필로 입력/)).toBeTruthy();
    expect(screen.getByText("₩1,400,000", { selector: "p.text-2xl.font-bold:not(.text-red-600)" })).toBeTruthy();
  });

  it("표: 최신 거래일 순, 종목 검색(대소문자 무시) 후 행 수 갱신", async () => {
    seed();
    renderView();
    const user = userEvent.setup();
    const rows = () => screen.getAllByRole("row").slice(1);
    expect(rows()).toHaveLength(4);
    expect(within(rows()[0]).getByText("2026-09-10")).toBeTruthy();
    await user.type(screen.getByPlaceholderText("자산 검색 (종목명)"), "voo");
    expect(rows()).toHaveLength(2);
  });

  it("통화별 종목 보유수량: KRW/USD 종목을 나눠 순수량 표시", () => {
    seed();
    renderView();
    const krwCol = screen.getByText("KRW 종목").parentElement!;
    const usdCol = screen.getByText("USD 종목").parentElement!;
    expect(within(krwCol).getByText("5주")).toBeTruthy();
    expect(within(usdCol).getByText("5주")).toBeTruthy();
  });

  it("데이터가 없으면 '데이터가 없습니다'", () => {
    seed(config({ holdings: [] }));
    renderView();
    expect(screen.getByText("데이터가 없습니다")).toBeTruthy();
  });
});

describe("AssetConfigView — 저장 동작 고정", () => {
  it("추가: 매수금액을 수량×단가로 계산해 해당 문서에 저장", async () => {
    seed();
    renderView();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /자산 추가/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("증권사 선택 또는 입력"), "C증권");
    await user.type(within(dialog).getByPlaceholderText("종목명 선택 또는 입력"), "신규ETF");
    await user.type(within(dialog).getByPlaceholderText("계좌번호 선택 또는 입력"), "999");
    const num = within(dialog).getAllByRole("spinbutton"); // 수량, 단가
    await user.type(num[0], "4");
    await user.type(num[1], "2500");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    const { path, data } = lastSave();
    expect(path).toBe(DOC_PATH);
    expect(data.holdings).toHaveLength(HOLDINGS.length + 1);
    expect(data.holdings.find((h) => h.ticker === "신규ETF")).toMatchObject({
      date: "2026-10-03", broker: "C증권", accountNumber: "999", country: "KOR", tradeType: "매수",
      quantity: 4, unitPrice: 2500, buyAmount: 10000, sellAmount: 0, appliedRate: 0,
    });
    expect(data.cash).toEqual(config().cash);
    expect(data.exchangeRate).toEqual(config().exchangeRate);
    expect(toastMock.success).toHaveBeenCalledWith("추가되었습니다");
  });

  it("추가: 기존 계좌번호를 입력하면 계좌유형 자동 채움이 저장 데이터에 반영", async () => {
    seed();
    renderView();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /자산 추가/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("종목명 선택 또는 입력"), "X");
    await user.type(within(dialog).getByPlaceholderText("계좌번호 선택 또는 입력"), "222");
    await user.type(within(dialog).getAllByRole("spinbutton")[0], "1");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(lastSave().data.holdings.find((h) => h.ticker === "X")!.accountType).toBe("ISA");
  });

  it("추가: 필수값 누락/잘못된 숫자는 저장하지 않고 오류 알림", async () => {
    seed();
    renderView();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /자산 추가/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(toastMock.error).toHaveBeenLastCalledWith("종목명·거래일·수량을 입력해주세요");
    await user.type(within(dialog).getByPlaceholderText("종목명 선택 또는 입력"), "X");
    await user.type(within(dialog).getAllByRole("spinbutton")[0], "-1");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(toastMock.error).toHaveBeenLastCalledWith("수량·단가·환율은 올바른 숫자여야 합니다");
    expect(firestoreModule.setDoc).not.toHaveBeenCalled();
  });

  it("수정: 같은 id만 교체하고 나머지는 보존", async () => {
    seed();
    renderView();
    const user = userEvent.setup();
    const row = screen.getAllByRole("row").find((r) => within(r).queryByText("2026-09-10"))!;
    await user.click(within(row).getAllByRole("button")[0]);
    const dialog = await screen.findByRole("dialog");
    const qty = within(dialog).getAllByRole("spinbutton")[0];
    await user.clear(qty);
    await user.type(qty, "7");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    const { data } = lastSave();
    expect(data.holdings).toHaveLength(HOLDINGS.length);
    expect(data.holdings.find((h) => h.id === "h4")).toMatchObject({ quantity: 7, buyAmount: 7 * 450 });
    expect(data.holdings.find((h) => h.id === "h1")).toEqual(HOLDINGS[0]);
    expect(toastMock.success).toHaveBeenCalledWith("수정되었습니다");
  });

  it("삭제: 공통 확인 다이얼로그에서 승인할 때만 제거(브라우저 confirm 미사용)", async () => {
    seed();
    renderView();
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm");
    const target = () => screen.getAllByRole("row").find((r) => within(r).queryByText("2026-09-10"))!;

    await user.click(within(target()).getAllByRole("button")[1]);
    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("항목 삭제")).toBeTruthy();
    expect(within(dialog).getByText(/VOO · 2026-09-10/)).toBeTruthy(); // 무엇을 지우는지 표시
    await user.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(firestoreModule.setDoc).not.toHaveBeenCalled();

    await user.click(within(target()).getAllByRole("button")[1]);
    dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "삭제" }));
    expect(lastSave().data.holdings.map((h) => h.id)).toEqual(["h1", "h2", "h3"]);
    expect(toastMock.success).toHaveBeenCalledWith("삭제되었습니다");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("현금 잔고 수정: 쉼표 입력 허용, 환율·종목은 그대로 두고 현금만 변경", async () => {
    seed();
    renderView();
    const user = userEvent.setup();
    // USD 자산 카드 상단의 연필(현금 잔고 수정)
    const usdCard = screen.getByText("USD 자산").closest("[data-slot=card]") as HTMLElement;
    await user.click(within(usdCard).getByRole("button"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("현금 잔고 수정")).toBeTruthy();
    const [krwInput, usdInput] = within(dialog).getAllByRole("textbox");
    expect((krwInput as HTMLInputElement).value).toBe("1,000,000");
    await user.clear(krwInput);
    await user.type(krwInput, "2,500,000");
    await user.clear(usdInput);
    await user.type(usdInput, "123.5");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    const { data } = lastSave();
    expect(data.cash).toMatchObject({ krw: 2_500_000, usd: 123.5 });
    expect(data.holdings).toEqual(HOLDINGS);
    expect(data.exchangeRate).toEqual(config().exchangeRate);
    expect(toastMock.success).toHaveBeenCalledWith("현금 잔고가 수정되었습니다");
  });

  it("환율 수정: 연필로 입력·저장하면 exchangeRate가 manual로 저장, 0/빈 값은 거부", async () => {
    seed(config({ exchangeRate: { rate: 0, source: "auto", fetchedAt: new Date(0).toISOString() }, holdings: HOLDINGS.map((h) => ({ ...h, appliedRate: 0 })) }));
    renderView();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("적용환율 수정"));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByPlaceholderText("예: 1473");
    await user.type(input, "0");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(firestoreModule.setDoc).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenLastCalledWith("적용환율은 0보다 큰 숫자여야 합니다");
    await user.clear(input);
    await user.type(input, "1,410.5");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    const { data } = lastSave();
    expect(data.exchangeRate).toMatchObject({ rate: 1410.5, source: "manual" });
    expect(typeof data.exchangeRate.fetchedAt).toBe("string");
    expect(toastMock.success).toHaveBeenCalledWith("적용환율이 저장되었습니다");
  });

  it("초기화: 종목·현금은 비우되 환율은 유지", async () => {
    seed();
    renderView();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /초기화/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "초기화" }));
    const { data } = lastSave();
    expect(data.holdings).toEqual([]);
    expect(data.cash).toMatchObject({ krw: 0, usd: 0 });
    expect(data.exchangeRate).toEqual(config().exchangeRate);
    expect(toastMock.success).toHaveBeenCalledWith("초기화되었습니다");
  });

  it("클라우드 백업·복원: asset-config 접두사로 저장/복원", async () => {
    seed();
    renderView();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /클라우드 백업/ }));
    expect(lastSave().path).toMatch(/^users\/u1\/backups\/asset-config-backup-2026-10-03T/);
    firestoreModule.setDoc.mockClear();

    const backup = config({ holdings: [HOLDINGS[0]] });
    firestoreModule.getDocs.mockResolvedValue({
      docs: [{ id: "asset-config-backup-2026-10-01T00:00:00.000Z", data: () => backup }],
    });
    await user.click(screen.getByRole("button", { name: /클라우드 복원/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "복원" }));
    expect(lastSave().path).toBe(DOC_PATH);
    expect(lastSave().data.holdings).toHaveLength(1);
  });
});

describe("AssetConfigView — 안정성(저장 실패·읽기 오류)", () => {
  it("저장 실패(자산 추가): 오류 알림, 성공 알림 없음, 다이얼로그 유지 후 재시도 가능", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    seed();
    renderView();
    firestoreModule.setDoc.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /자산 추가/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("종목명 선택 또는 입력"), "신규");
    await user.type(within(dialog).getAllByRole("spinbutton")[0], "1");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(toastMock.error).toHaveBeenLastCalledWith(MSG_SAVE_FAILED);
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    firestoreModule.setDoc.mockResolvedValue(undefined);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "저장" }));
    expect(toastMock.success).toHaveBeenCalledWith("추가되었습니다");
  });

  it("저장 실패(환율·현금·삭제·초기화): 모두 오류 알림만", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    seed();
    renderView();
    firestoreModule.setDoc.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();

    await user.click(screen.getByLabelText("적용환율 수정"));
    let dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(toastMock.error).toHaveBeenLastCalledWith(MSG_SAVE_FAILED);
    await user.keyboard("{Escape}");

    const usdCard = screen.getByText("USD 자산").closest("[data-slot=card]") as HTMLElement;
    await user.click(within(usdCard).getByRole("button"));
    dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(toastMock.error).toHaveBeenLastCalledWith(MSG_SAVE_FAILED);
    await user.keyboard("{Escape}");

    const row = screen.getAllByRole("row").find((r) => within(r).queryByText("2026-09-10"))!;
    await user.click(within(row).getAllByRole("button")[1]);
    dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "삭제" }));
    expect(toastMock.error).toHaveBeenLastCalledWith(MSG_SAVE_FAILED);
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: /초기화/ }));
    dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "초기화" }));
    expect(toastMock.error).toHaveBeenLastCalledWith(MSG_SAVE_FAILED);
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("읽기 오류: 경고 배너 + 쓰기 버튼 잠금 + 기존 문서 덮어쓰기 불가", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    seed();
    firestoreState.listenError = true;
    renderView();
    expect(screen.getByRole("alert").textContent).toMatch(/불러오지 못해 편집이 잠겨 있습니다/);
    for (const name of [/가져오기/, /클라우드 백업/, /클라우드 복원/, /초기화/, /자산 추가/]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    // 연필(현금/환율)로 저장을 시도해도 save가 거부되어 문서에 쓰지 않는다
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("적용환율 수정"));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("예: 1473"), "1400");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(firestoreModule.setDoc).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenLastCalledWith(MSG_SAVE_FAILED);
  });

  it("정상일 때는 경고 배너가 없다", () => {
    seed();
    renderView();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("AssetConfigView — 환율 자동 조회", () => {
  const frankfurterOk = () =>
    Promise.resolve({ ok: true, status: 200, json: async () => ({ base: "USD", date: "2026-10-02", rates: { KRW: 1348.28 } }) } as Response);
  const rateless = () =>
    config({ exchangeRate: { rate: 0, source: "auto", fetchedAt: new Date(0).toISOString() }, holdings: HOLDINGS.map((h) => ({ ...h, appliedRate: 0 })) });

  async function openRateDialog() {
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("적용환율 수정"));
    const dialog = await screen.findByRole("dialog");
    return { user, dialog };
  }

  it("화면을 열거나 환율 창을 열어도 외부 환율 서비스를 호출하지 않는다(버튼을 눌렀을 때만)", async () => {
    const fetchMock = vi.fn(frankfurterOk);
    vi.stubGlobal("fetch", fetchMock);
    seed(rateless());
    renderView();
    await openRateDialog();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("자동 조회: 입력칸을 채우고 출처·기준일을 보여주며, 저장하면 source=auto로 기록", async () => {
    vi.stubGlobal("fetch", vi.fn(frankfurterOk));
    seed(rateless());
    renderView();
    const { user, dialog } = await openRateDialog();
    await user.click(within(dialog).getByRole("button", { name: "자동 조회" }));
    const input = (await within(dialog).findByDisplayValue("1,348.28")) as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(within(dialog).getByText(/Frankfurter\(ECB\) · 2026-10-02 기준/)).toBeTruthy();
    expect(firestoreModule.setDoc).not.toHaveBeenCalled(); // 조회만으로는 저장하지 않는다
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(lastSave().data.exchangeRate).toMatchObject({ rate: 1348.28, source: "auto" });
    expect(toastMock.success).toHaveBeenCalledWith("적용환율이 저장되었습니다");
  });

  it("자동 조회 후 사용자가 값을 고치면 source=manual로 기록하고 출처 표시는 사라진다", async () => {
    vi.stubGlobal("fetch", vi.fn(frankfurterOk));
    seed(rateless());
    renderView();
    const { user, dialog } = await openRateDialog();
    await user.click(within(dialog).getByRole("button", { name: "자동 조회" }));
    const input = await within(dialog).findByDisplayValue("1,348.28");
    await user.clear(input);
    await user.type(input, "1400");
    expect(within(dialog).queryByText(/기준/)).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(lastSave().data.exchangeRate).toMatchObject({ rate: 1400, source: "manual" });
  });

  it("조회 실패: 오류 안내, 입력값 유지, 직접 입력·저장은 계속 가능", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("network"))));
    seed(rateless());
    renderView();
    const { user, dialog } = await openRateDialog();
    const input = within(dialog).getByPlaceholderText("예: 1473") as HTMLInputElement;
    await user.type(input, "1410");
    await user.click(within(dialog).getByRole("button", { name: "자동 조회" }));
    await vi.waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(MSG_RATE_FETCH_FAILED));
    expect(input.value).toBe("1,410");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(lastSave().data.exchangeRate).toMatchObject({ rate: 1410, source: "manual" });
  });

  it("조회 중에는 버튼이 잠겨 중복 호출을 막는다", async () => {
    let release: (r: Response) => void = () => {};
    const fetchMock = vi.fn(() => new Promise<Response>((res) => { release = res; }));
    vi.stubGlobal("fetch", fetchMock);
    seed(rateless());
    renderView();
    const { user, dialog } = await openRateDialog();
    const button = within(dialog).getByRole("button", { name: "자동 조회" }) as HTMLButtonElement;
    await user.click(button);
    await vi.waitFor(() => expect((within(dialog).getByRole("button", { name: /조회 중/ }) as HTMLButtonElement).disabled).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release(await frankfurterOk());
    await within(dialog).findByDisplayValue("1,348.28");
    expect((within(dialog).getByRole("button", { name: "자동 조회" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("읽기 오류 상태에서는 환율을 조회해도 저장할 수 없다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(frankfurterOk));
    seed(rateless());
    firestoreState.listenError = true;
    renderView();
    const { user, dialog } = await openRateDialog();
    await user.click(within(dialog).getByRole("button", { name: "자동 조회" }));
    await within(dialog).findByDisplayValue("1,348.28");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(firestoreModule.setDoc).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenLastCalledWith(MSG_SAVE_FAILED);
  });
});
