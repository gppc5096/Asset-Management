"use client";

import { useState } from "react";

/**
 * 필터 조건(filterKey)이 바뀌면 표시 개수를 pageSize로 되돌리는 "더보기" 페이지네이션.
 * 렌더 중 setState로 리셋하는 것은 React의 파생 상태 패턴(getDerivedStateFromProps 대응)이다.
 */
export function usePaginatedFilter<T>(filtered: T[], filterKey: string, pageSize = 10) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setVisibleCount(pageSize);
  }
  const visible = filtered.slice(0, visibleCount);

  function showMore() {
    setVisibleCount((c) => c + pageSize);
  }

  return { visible, visibleCount, showMore };
}
