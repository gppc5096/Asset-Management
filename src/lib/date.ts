/** 로컬(KST) 기준 YYYY-MM-DD. toISOString()은 UTC라 자정 근처에 하루가 밀린다. */
export function localDateString(d = new Date()) {
  return d.toLocaleDateString("sv-SE");
}
