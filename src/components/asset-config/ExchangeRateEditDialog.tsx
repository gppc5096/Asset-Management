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
};

export function ExchangeRateEditDialog({
  open,
  onOpenChange,
  rate,
  onRateChange,
  onSubmit,
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
          <Input
            type="text"
            inputMode="decimal"
            value={formatNumericInput(rate)}
            onChange={(e) => onRateChange(parseNumericInput(e.target.value))}
            placeholder="예: 1473"
          />
        </label>
        <DialogFooter>
          <Button onClick={onSubmit}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
