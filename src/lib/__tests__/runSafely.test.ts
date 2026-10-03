import { afterEach, describe, expect, it, vi } from "vitest";
import { runSafely } from "@/lib/runSafely";
import { toastMock } from "@/test/toastMock";

afterEach(() => vi.restoreAllMocks());

describe("runSafely", () => {
  it("성공하면 true를 반환하고 오류 알림을 띄우지 않는다", async () => {
    const task = vi.fn(async () => {});
    await expect(runSafely(task, "실패")).resolves.toBe(true);
    expect(task).toHaveBeenCalledTimes(1);
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("거부(throw)되면 예외를 삼키고 false를 반환하며 오류 알림 + 콘솔 기록", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(runSafely(async () => { throw new Error("boom"); }, "저장 실패")).resolves.toBe(false);
    expect(toastMock.error).toHaveBeenCalledWith("저장 실패");
    expect(consoleError).toHaveBeenCalled();
  });

  it("동기적으로 throw하는 task도 안전하게 처리", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = (() => { throw new Error("sync"); }) as unknown as () => Promise<void>;
    await expect(runSafely(bad, "실패")).resolves.toBe(false);
    expect(toastMock.error).toHaveBeenCalledWith("실패");
  });
});
