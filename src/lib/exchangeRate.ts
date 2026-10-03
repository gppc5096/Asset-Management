/**
 * USD/KRW 환율 자동 조회.
 * - 사용자가 "자동 조회"를 눌렀을 때만 호출한다(화면 로딩/저장 흐름이 외부 서비스에 의존하지 않도록).
 * - 키가 필요 없고 브라우저 CORS를 허용하는 무료 서비스 두 곳을 순서대로 시도한다.
 * - 응답 값은 상식 범위(RATE_MIN~RATE_MAX)를 벗어나면 버린다 — 잘못된 환율이 총자산을 왜곡하는 것을 막는다.
 */

export const MSG_RATE_FETCH_FAILED = "환율을 자동으로 조회하지 못했습니다. 직접 입력해주세요";

export const RATE_MIN = 500;
export const RATE_MAX = 5000;

export type FetchedRate = {
  /** 소수 둘째 자리로 반올림한 USD/KRW */
  rate: number;
  /** 환율 기준일(YYYY-MM-DD) */
  asOf: string;
  provider: string;
};

type Provider = {
  name: string;
  url: string;
  parse: (body: unknown) => FetchedRate | null;
};

function validRate(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const rounded = Math.round(v * 100) / 100;
  return rounded >= RATE_MIN && rounded <= RATE_MAX ? rounded : null;
}

function krwOf(body: unknown): unknown {
  if (!body || typeof body !== "object") return undefined;
  const rates = (body as { rates?: unknown }).rates;
  if (!rates || typeof rates !== "object") return undefined;
  return (rates as { KRW?: unknown }).KRW;
}

/** https://api.frankfurter.dev — 유럽중앙은행(ECB) 일일 기준환율 */
export function parseFrankfurter(body: unknown): FetchedRate | null {
  const rate = validRate(krwOf(body));
  const date = (body as { date?: unknown } | null)?.date;
  if (rate === null || typeof date !== "string") return null;
  return { rate, asOf: date, provider: "Frankfurter(ECB)" };
}

/** https://open.er-api.com — ExchangeRate-API 무료 엔드포인트(일 1회 갱신) */
export function parseErApi(body: unknown): FetchedRate | null {
  if ((body as { result?: unknown } | null)?.result === "error") return null;
  const rate = validRate(krwOf(body));
  if (rate === null) return null;
  const updated = (body as { time_last_update_utc?: unknown }).time_last_update_utc;
  const parsed = typeof updated === "string" ? new Date(updated) : null;
  const asOf =
    parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : "";
  return { rate, asOf, provider: "ExchangeRate-API" };
}

const PROVIDERS: Provider[] = [
  {
    name: "Frankfurter",
    url: "https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW",
    parse: parseFrankfurter,
  },
  { name: "ExchangeRate-API", url: "https://open.er-api.com/v6/latest/USD", parse: parseErApi },
];

async function tryProvider(
  provider: Provider,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<FetchedRate | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(provider.url, { signal: controller.signal });
    if (!res.ok) return null;
    return provider.parse(await res.json());
  } catch {
    return null; // 네트워크 오류/시간 초과/JSON 오류 — 다음 서비스로
  } finally {
    clearTimeout(timer);
  }
}

/** 현재 USD/KRW를 조회한다. 모든 서비스가 실패하면 예외를 던진다. */
export async function fetchUsdKrwRate(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8000
): Promise<FetchedRate> {
  for (const provider of PROVIDERS) {
    const result = await tryProvider(provider, fetchImpl, timeoutMs);
    if (result) return result;
  }
  throw new Error("환율을 조회하지 못했습니다");
}
