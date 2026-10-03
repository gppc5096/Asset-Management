/** 입력값에서 콤마 등을 제거하고 숫자(소수점 하나 포함)만 남긴다. */
export function parseNumericInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return (
    cleaned.slice(0, firstDot + 1) +
    cleaned.slice(firstDot + 1).replace(/\./g, "")
  );
}

/** 순수 숫자 문자열(예: "30000000.5")을 천단위 콤마가 붙은 표시용 문자열로 변환. */
export function formatNumericInput(raw: string): string {
  if (raw === "") return "";
  const [intPart, decPart] = raw.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
}

/** 원화 금액을 "₩1,234" 형태로 반올림 표시. */
export function formatKrw(n: number): string {
  return `₩${Math.round(n).toLocaleString()}`;
}
