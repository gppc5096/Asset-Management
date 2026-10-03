import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePaginatedFilter } from "@/hooks/usePaginatedFilter";

const items = Array.from({ length: 25 }, (_, i) => i);

describe("usePaginatedFilter", () => {
  it("처음에는 pageSize(기본 10)만큼 보여주고 showMore로 늘린다", () => {
    const { result } = renderHook(() => usePaginatedFilter(items, "k"));
    expect(result.current.visible).toHaveLength(10);
    act(() => result.current.showMore());
    expect(result.current.visible).toHaveLength(20);
    act(() => result.current.showMore());
    expect(result.current.visible).toHaveLength(25); // 전체를 넘지 않음
    expect(result.current.visibleCount).toBe(30);
  });

  it("filterKey가 바뀌면 표시 개수가 pageSize로 되돌아간다", () => {
    const { result, rerender } = renderHook(({ key }) => usePaginatedFilter(items, key), {
      initialProps: { key: "a" },
    });
    act(() => result.current.showMore());
    expect(result.current.visible).toHaveLength(20);
    rerender({ key: "b" });
    expect(result.current.visible).toHaveLength(10);
  });

  it("filterKey가 같으면 더보기 상태를 유지한다", () => {
    const { result, rerender } = renderHook(({ key }) => usePaginatedFilter(items, key), {
      initialProps: { key: "a" },
    });
    act(() => result.current.showMore());
    rerender({ key: "a" });
    expect(result.current.visible).toHaveLength(20);
  });

  it("pageSize 지정", () => {
    const { result } = renderHook(() => usePaginatedFilter(items, "k", 5));
    expect(result.current.visible).toHaveLength(5);
  });
});
