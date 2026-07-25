import type { Timestamp } from "firebase/firestore";

/**
 * Firestore serverTimestamp()로 저장된 최상위 updatedAt 필드는 Timestamp 인스턴스로 돌아온다
 * (반면 cash.updatedAt/exchangeRate.fetchedAt처럼 클라이언트에서 직접 string으로 쓴 필드는 그대로 string).
 * 두 경우 모두 안전하게 ISO 문자열로 정규화한다.
 */
export function normalizeTimestamp(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as Timestamp).toDate === "function"
  ) {
    return (value as Timestamp).toDate().toISOString();
  }
  return new Date(0).toISOString();
}
