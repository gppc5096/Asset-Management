import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDistributionRecords } from "@/hooks/useDistributionRecords";
import { authState, firestoreModule, firestoreState } from "@/test/firebaseMock";
import { toastMock } from "@/test/toastMock";
import { makeRecord } from "@/test/factories";

const PATH = "users/u1/backups/general";
const doc = (records = [makeRecord({ id: "r1" })]) => ({ records, updatedAt: "2026-10-02T00:00:00.000Z" });

describe("useDistributionRecords", () => {
  it("문서를 구독해 데이터를 읽고 loading을 끝낸다", () => {
    firestoreState.docs.set(PATH, doc());
    const { result } = renderHook(() => useDistributionRecords("general"));
    expect(result.current.loading).toBe(false);
    expect(result.current.loadError).toBe(false);
    expect(result.current.data.records.map((r) => r.id)).toEqual(["r1"]);
  });

  it("문서가 없거나 형식이 틀려도 빈 데이터로 시작(쓰기는 허용 — 복구 가능해야 함)", async () => {
    const { result, unmount } = renderHook(() => useDistributionRecords("general"));
    expect(result.current.data.records).toEqual([]);
    expect(result.current.loadError).toBe(false);
    await act(async () => result.current.save(doc()));
    unmount();
    firestoreState.docs.set(PATH, { records: "broken" });
    const second = renderHook(() => useDistributionRecords("general"));
    expect(second.result.current.data.records).toEqual([]);
    expect(second.result.current.loadError).toBe(false);
  });

  it("save는 해당 계좌 문서 경로에 그대로 쓴다", async () => {
    firestoreState.docs.set(PATH, doc());
    const { result } = renderHook(() => useDistributionRecords("general"));
    const next = doc([]);
    await act(async () => result.current.save(next));
    const [ref, data] = firestoreModule.setDoc.mock.calls[0];
    expect(ref.path).toBe(PATH);
    expect(data).toBe(next);
  });

  it("읽기 오류(권한/서비스 오류)면 loadError=true, 알림, 그리고 save를 거부해 기존 문서를 덮어쓰지 않는다", async () => {
    firestoreState.listenError = true;
    const { result } = renderHook(() => useDistributionRecords("general"));
    expect(result.current.loading).toBe(false);
    expect(result.current.loadError).toBe(true);
    expect(toastMock.error).toHaveBeenCalledWith("분배금 데이터를 불러오지 못했습니다");
    await expect(result.current.save(doc())).rejects.toThrow();
    expect(firestoreModule.setDoc).not.toHaveBeenCalled();
  });

  it("로그인 상태가 아니면 save는 조용히 성공하지 않고 거부한다", async () => {
    authState.user = null;
    const { result } = renderHook(() => useDistributionRecords("general"));
    expect(result.current.data.records).toEqual([]);
    await expect(result.current.save(doc())).rejects.toThrow();
    expect(firestoreModule.setDoc).not.toHaveBeenCalled();
  });
});
