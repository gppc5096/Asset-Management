import { prettyDOM } from "@testing-library/react";

/**
 * 스냅샷용 DOM 직렬화. React useId가 만드는 자동 ID(_r_<base36>_)와 base-ui ID는 컴포넌트 구조가 바뀌면
 * 번호가 밀려 가짜 차이를 만들므로 정규화한다.
 */
export function domText(node: Element | Document): string {
  const html = prettyDOM(node, Infinity, { highlight: false }) || "";
  // React useId(_r_<base36>_)와 base-ui 자동 ID는 컴포넌트 수에 따라 번호가 바뀌므로 정규화
  return html.replace(/_r_[0-9a-z]+_/g, "_r_ID_") + "\n";
}
