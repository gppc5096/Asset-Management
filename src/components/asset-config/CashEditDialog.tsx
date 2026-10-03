"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumericInput, parseNumericInput } from "@/lib/format";

export type CashFormState = { krw: string; usd: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: CashFormState;
  onFormChange: (form: CashFormState) => void;
  onSubmit: () => void;
};

export function CashEditDialog({ open, onOpenChange, form, onFormChange, onSubmit }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>현금 잔고 수정</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            KRW 현금
            <Input
              type="text"
              inputMode="decimal"
              value={formatNumericInput(form.krw)}
              onChange={(e) => onFormChange({ ...form, krw: parseNumericInput(e.target.value) })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            USD 현금
            <Input
              type="text"
              inputMode="decimal"
              value={formatNumericInput(form.usd)}
              onChange={(e) => onFormChange({ ...form, usd: parseNumericInput(e.target.value) })}
            />
          </label>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
