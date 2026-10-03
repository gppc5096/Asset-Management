"use client";

/**
 * 데이터 읽기에 실패해 화면의 값이 실제 저장본이 아닐 때 표시하는 경고.
 * 이 상태에서 저장하면 기존 문서를 빈 값으로 덮어쓸 수 있어 편집을 잠근다.
 */
export function LoadErrorNotice() {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      데이터를 불러오지 못해 편집이 잠겨 있습니다. 네트워크와 로그인 상태를 확인한 뒤 새로고침해주세요.
    </div>
  );
}
