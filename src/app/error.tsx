"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-50 px-4 text-center">
      <h1 className="text-xl font-bold">문제가 발생했습니다</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        페이지를 표시하는 중 오류가 발생했습니다. 데이터를 가져오기(가져오기/복원) 한 파일 형식이
        잘못되었을 수 있습니다.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => reset()}>
          다시 시도
        </Button>
        <Button onClick={() => (window.location.href = "/")}>대시보드로 이동</Button>
      </div>
    </div>
  );
}
