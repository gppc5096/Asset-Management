/** 로컬(KST) 기준 YYYY-MM-DD. toISOString()은 UTC라 자정 근처에 하루가 밀린다. */
export function localDateString(d = new Date()) {
  return d.toLocaleDateString("sv-SE");
}

/** 로컬 기준 달력상 지난달 키 (YYYY-MM). */
export function previousMonthKey(d = new Date()) {
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const y = prev.getFullYear();
  const m = String(prev.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** 특정 일자(YYYY-MM-DD) 기준 전달 키 (YYYY-MM). */
export function previousMonthKeyFromDate(dateStr: string) {
  const y = Number(dateStr.slice(0, 4));
  const m = Number(dateStr.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return previousMonthKey();
  }
  const prev = new Date(y, m - 2, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}
