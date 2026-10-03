import { describe, expect, it, vi } from "vitest";
import {
  RATE_MAX,
  RATE_MIN,
  fetchUsdKrwRate,
  parseErApi,
  parseFrankfurter,
} from "@/lib/exchangeRate";

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
const bad = (status = 500) => ({ ok: false, status, json: async () => ({}) }) as Response;
const frankfurter = (krw: unknown, date = "2026-10-02") => ({ base: "USD", date, rates: { KRW: krw } });
const erApi = (krw: unknown) => ({ result: "success", time_last_update_utc: "Sat, 03 Oct 2026 00:02:32 +0000", rates: { KRW: krw } });

describe("parseFrankfurter / parseErApi", () => {
  it("정상 응답에서 환율·기준일을 읽고 소수 둘째 자리로 반올림", () => {
    expect(parseFrankfurter(frankfurter(1348.2849))).toEqual({ rate: 1348.28, asOf: "2026-10-02", provider: "Frankfurter(ECB)" });
    const r = parseErApi(erApi(1347.389067))!;
    expect(r.rate).toBe(1347.39);
    expect(r.provider).toBe("ExchangeRate-API");
    expect(r.asOf).toBe("2026-10-03");
  });

  it("형식이 다르거나 값이 이상하면 null (0, 음수, NaN, 문자열, 범위 밖)", () => {
    for (const v of [0, -5, NaN, Infinity, "1348", null, undefined, RATE_MIN - 1, RATE_MAX + 1]) {
      expect(parseFrankfurter(frankfurter(v))).toBeNull();
      expect(parseErApi(erApi(v))).toBeNull();
    }
    for (const body of [null, undefined, 42, "x", {}, { rates: null }, { rates: {} }]) {
      expect(parseFrankfurter(body)).toBeNull();
      expect(parseErApi(body)).toBeNull();
    }
  });

  it("범위 경계값은 허용", () => {
    expect(parseFrankfurter(frankfurter(RATE_MIN))?.rate).toBe(RATE_MIN);
    expect(parseFrankfurter(frankfurter(RATE_MAX))?.rate).toBe(RATE_MAX);
  });

  it("er-api가 result: error를 돌려주면 null", () => {
    expect(parseErApi({ result: "error", rates: { KRW: 1300 } })).toBeNull();
  });
});

describe("fetchUsdKrwRate", () => {
  it("첫 서비스가 성공하면 그 값을 쓰고 두 번째는 호출하지 않는다", async () => {
    const f = vi.fn().mockResolvedValueOnce(ok(frankfurter(1348.28)));
    const r = await fetchUsdKrwRate(f as unknown as typeof fetch);
    expect(r.rate).toBe(1348.28);
    expect(f).toHaveBeenCalledTimes(1);
    expect(String(f.mock.calls[0][0])).toContain("frankfurter");
  });

  it("첫 서비스가 실패(HTTP 오류/네트워크 오류/이상한 값)하면 대체 서비스로 넘어간다", async () => {
    for (const first of [() => Promise.resolve(bad(503)), () => Promise.reject(new TypeError("network")), () => Promise.resolve(ok(frankfurter(0)))]) {
      const f = vi.fn().mockImplementationOnce(first).mockResolvedValueOnce(ok(erApi(1347.39)));
      const r = await fetchUsdKrwRate(f as unknown as typeof fetch);
      expect(r).toMatchObject({ rate: 1347.39, provider: "ExchangeRate-API" });
      expect(f).toHaveBeenCalledTimes(2);
    }
  });

  it("HTTP 오류 상태면 본문에 그럴듯한 환율이 있어도 버리고 대체 서비스를 쓴다", async () => {
    const errorWithBody = { ok: false, status: 503, json: async () => frankfurter(1111) } as Response;
    const f = vi.fn().mockResolvedValueOnce(errorWithBody).mockResolvedValueOnce(ok(erApi(1347.39)));
    const r = await fetchUsdKrwRate(f as unknown as typeof fetch);
    expect(r.rate).toBe(1347.39);
  });

  it("두 서비스 모두 실패하면 예외를 던진다(호출자가 직접 입력을 안내)", async () => {
    const f = vi.fn().mockResolvedValue(bad(500));
    await expect(fetchUsdKrwRate(f as unknown as typeof fetch)).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("응답이 오지 않으면 시간 제한 후 포기하고 대체 서비스를 시도한다", async () => {
    vi.useFakeTimers();
    try {
      const hang = (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))));
      const f = vi.fn().mockImplementationOnce(hang).mockResolvedValueOnce(ok(erApi(1347.39)));
      const p = fetchUsdKrwRate(f as unknown as typeof fetch, 3000);
      await vi.advanceTimersByTimeAsync(3000);
      await expect(p).resolves.toMatchObject({ rate: 1347.39 });
    } finally {
      vi.useRealTimers();
    }
  });
});
