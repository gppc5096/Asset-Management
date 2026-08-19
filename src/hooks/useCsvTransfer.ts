"use client";

import { useState } from "react";
import { toast } from "sonner";

/** CSV 내보내기 다운로드 + 가져오기(파일선택 → 파싱 → 확인대기) 흐름을 캡슐화. */
export function useCsvTransfer<T>(
  toCsv: (items: T[]) => string,
  parseCsv: (text: string) => T[] | null,
  invalidFormatMessage: string
) {
  const [pendingImport, setPendingImport] = useState<T[] | null>(null);

  function exportCsv(items: T[], filename: string) {
    const csv = toCsv(items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function pickImportFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const items = parseCsv(text);
      if (!items) {
        toast.error(invalidFormatMessage);
        return;
      }
      if (items.length === 0) {
        toast.error("가져올 수 있는 유효한 행이 없습니다");
        return;
      }
      setPendingImport(items);
    };
    input.click();
  }

  function cancelImport() {
    setPendingImport(null);
  }

  return { pendingImport, exportCsv, pickImportFile, cancelImport };
}
