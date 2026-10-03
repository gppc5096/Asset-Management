"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumericInput, parseNumericInput } from "@/lib/format";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rate: string;
  onRateChange: (rate: string) => void;
  onSubmit: () => void;
  /** "자동 조회" 버튼: 현재 환율을 가져와 입력칸에 채운다(저장은 사용자가 확인 후 직접) */
  onFetch: () => void;
  fetching: boolean;
  /** 자동 조회로 채운 값의 출처·기준일 안내. 사용자가 값을 고치면 null */
  fetchInfo: string | null;
};

export function ExchangeRateEditDialog({
  open,
  onOpenChange,
  rate,
  onRateChange,
  onSubmit,
  onFetch,
  fetching,
  fetchInfo,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>적용환율 수정</DialogTitle>
          <DialogDescription>
            USD 자산을 KRW로 환산할 때 사용하는 환율(USD/KRW)입니다. 총 자산(추정)에 반영됩니다.
          </DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1 text-sm">
          적용환율 (USD/KRW)
          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="decimal"
              value={formatNumericInput(rate)}
              onChange={(e) => onRateChange(parseNumericInput(e.target.value))}
              placeholder="예: 1473"
            />
            <Button type="button" variant="outline" onClick={onFetch} disabled={fetching}>
              {fetching ? "조회 중..." : "자동 조회"}
            </Button>
          </div>
        </label>
        {fetchInfo && <p className="text-xs text-muted-foreground">{fetchInfo}</p>}
        <DialogFooter>
          <Button onClick={onSubmit}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
