import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAssetConfig } from "@/hooks/useAssetConfig";
import { authState, firestoreModule, firestoreState } from "@/test/firebaseMock";
import { toastMock } from "@/test/toastMock";
import { CASH, ZERO_RATE, makeHolding } from "@/test/factories";

const PATH = "users/u1/backups/asset-config";
const cfg = (holdings = [makeHolding({ id: "h1" })]) => ({
  holdings,
  cash: CASH,
  exchangeRate: ZERO_RATE,
  updatedAt: "2026-10-02T00:00:00.000Z",
});

describe("useAssetConfig", () => {
  it("문서를 구독해 데이터를 읽는다", () => {
    firestoreState.docs.set(PATH, cfg());
    const { result } = renderHook(() => useAssetConfig());
    expect(result.current.loading).toBe(false);
    expect(result.current.loadError).toBe(false);
    expect(result.current.data.holdings.map((h) => h.id)).toEqual(["h1"]);
  });

  it("문서가 없거나 형식이 틀리면 빈 기본값(환율 0), loadError는 아니다", () => {
    const { result } = renderHook(() => useAssetConfig());
    expect(result.current.data.holdings).toEqual([]);
    expect(result.current.data.exchangeRate.rate).toBe(0);
    expect(result.current.loadError).toBe(false);
    firestoreState.docs.set(PATH, { holdings: [], cash: {} });
    const broken = renderHook(() => useAssetConfig());
    expect(broken.result.current.data.holdings).toEqual([]);
    expect(broken.result.current.loadError).toBe(false);
  });

  it("save는 asset-config 문서에 그대로 쓴다", async () => {
    firestoreState.docs.set(PATH, cfg());
    const { result } = renderHook(() => useAssetConfig());
    const next = cfg([]);
    await act(async () => result.current.save(next));
    const [ref, data] = firestoreModule.setDoc.mock.calls[0];
    expect(ref.path).toBe(PATH);
    expect(data).toBe(next);
  });

  it("읽기 오류면 loadError=true, 알림, save 거부(기존 자산 데이터 보호)", async () => {
    firestoreState.listenError = true;
    const { result } = renderHook(() => useAssetConfig());
    expect(result.current.loadError).toBe(true);
    expect(toastMock.error).toHaveBeenCalledWith("자산 데이터를 불러오지 못했습니다");
    await expect(result.current.save(cfg())).rejects.toThrow();
    expect(firestoreModule.setDoc).not.toHaveBeenCalled();
  });

  it("로그인 상태가 아니면 save를 거부한다", async () => {
    authState.user = null;
    const { result } = renderHook(() => useAssetConfig());
    await expect(result.current.save(cfg())).rejects.toThrow();
    expect(firestoreModule.setDoc).not.toHaveBeenCalled();
  });
});
