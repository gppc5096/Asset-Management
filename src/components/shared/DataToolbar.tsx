"use client";

import { Plus, Download, Upload, CloudUpload, CloudDownload, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  loading: boolean;
  onExport: () => void;
  onImport: () => void;
  onBackup: () => void;
  onRestore: () => void;
  onReset: () => void;
  onAdd: () => void;
};

/** 자산관리·분배금 화면 공통 데이터 관리 도구 모음(내보내기/가져오기/백업/복원/초기화/추가). */
export function DataToolbar({
  loading,
  onExport,
  onImport,
  onBackup,
  onRestore,
  onReset,
  onAdd,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={onExport}>
        <Download className="mr-1 h-4 w-4" /> 내보내기
      </Button>
      <Button variant="outline" size="sm" onClick={onImport} disabled={loading}>
        <Upload className="mr-1 h-4 w-4" /> 가져오기
      </Button>
      <Button variant="outline" size="sm" onClick={onBackup} disabled={loading}>
        <CloudUpload className="mr-1 h-4 w-4" /> 클라우드 백업
      </Button>
      <Button variant="outline" size="sm" onClick={onRestore} disabled={loading}>
        <CloudDownload className="mr-1 h-4 w-4" /> 클라우드 복원
      </Button>
      <Button variant="outline" size="sm" onClick={onReset} disabled={loading}>
        <RotateCcw className="mr-1 h-4 w-4" /> 초기화
      </Button>
      <Button size="sm" onClick={onAdd} className="ml-auto" disabled={loading}>
        <Plus className="mr-1 h-4 w-4" /> 자산 추가
      </Button>
    </div>
  );
}
