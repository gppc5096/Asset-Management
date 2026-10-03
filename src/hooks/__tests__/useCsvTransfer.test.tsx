import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCsvTransfer } from "@/hooks/useCsvTransfer";
import { toastMock } from "@/test/toastMock";

const INVALID = "형식 오류";

/** pickImportFile이 만드는 <input type=file>을 가로채 파일 선택을 흉내낸다. */
function pickFile(text: string | null) {
  const created: HTMLInputElement[] = [];
  vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
    created.push(this);
  });
  return async () => {
    const input = created[0];
    if (!input) throw new Error("input이 생성되지 않음");
    const files = text === null ? [] : [{ text: async () => text }];
    Object.defineProperty(input, "files", { value: files, configurable: true });
    await act(async () => {
      await (input.onchange as () => Promise<void>)();
    });
  };
}

afterEach(() => vi.restoreAllMocks());

describe("useCsvTransfer", () => {
  const parse = (t: string) => (t.startsWith("OK") ? t.split(",").slice(1) : t === "EMPTY" ? [] : null);
  const setup = () => renderHook(() => useCsvTransfer<string>((items) => items.join(","), parse, INVALID));

  it("파일 선택 → 파싱 성공 시 pendingImport에 보관(확인 대기)", async () => {
    const { result } = setup();
    const select = pickFile("OK,a,b");
    act(() => result.current.pickImportFile());
    expect(result.current.pendingImport).toBeNull();
    await select();
    expect(result.current.pendingImport).toEqual(["a", "b"]);
  });

  it("형식 오류(null)면 오류 알림, 보관하지 않음", async () => {
    const { result } = setup();
    const select = pickFile("garbage");
    act(() => result.current.pickImportFile());
    await select();
    expect(toastMock.error).toHaveBeenCalledWith(INVALID);
    expect(result.current.pendingImport).toBeNull();
  });

  it("유효한 행이 0건이면 별도 오류 알림", async () => {
    const { result } = setup();
    const select = pickFile("EMPTY");
    act(() => result.current.pickImportFile());
    await select();
    expect(toastMock.error).toHaveBeenCalledWith("가져올 수 있는 유효한 행이 없습니다");
    expect(result.current.pendingImport).toBeNull();
  });

  it("파일 선택을 취소하면(파일 없음) 아무 일도 없다", async () => {
    const { result } = setup();
    const select = pickFile(null);
    act(() => result.current.pickImportFile());
    await select();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(result.current.pendingImport).toBeNull();
  });

  it("cancelImport는 보관 중인 가져오기를 비운다", async () => {
    const { result } = setup();
    const select = pickFile("OK,a");
    act(() => result.current.pickImportFile());
    await select();
    act(() => result.current.cancelImport());
    expect(result.current.pendingImport).toBeNull();
  });
});
