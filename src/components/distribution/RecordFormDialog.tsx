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
import { Combobox } from "@/components/ui/combobox";

export type RecordFormState = {
  ticker: string;
  date: string;
  quantity: string;
  price: string;
  distribution: string;
  taxBase: string;
  held: boolean;
};

export const EMPTY_RECORD_FORM: RecordFormState = {
  ticker: "",
  date: "",
  quantity: "",
  price: "",
  distribution: "",
  taxBase: "",
  held: true,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: RecordFormState;
  onFormChange: (form: RecordFormState) => void;
  tickerOptions: string[];
  onTickerChange: (ticker: string) => void;
  onSubmit: () => void;
};

export function RecordFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  onFormChange,
  tickerOptions,
  onTickerChange,
  onSubmit,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "자산 수정" : "자산 추가"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 flex flex-col gap-1 text-sm">
            종목명
            <Combobox
              value={form.ticker}
              onChange={onTickerChange}
              options={tickerOptions}
              placeholder="지난달 종목 선택 또는 입력"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            거래일
            <Input
              type="date"
              value={form.date}
              onChange={(e) => onFormChange({ ...form, date: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            수량
            <Input
              type="number"
              value={form.quantity}
              onChange={(e) => onFormChange({ ...form, quantity: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            현주가
            <Input
              type="number"
              value={form.price}
              onChange={(e) => onFormChange({ ...form, price: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            주당 분배금
            <Input
              type="number"
              value={form.distribution}
              onChange={(e) => onFormChange({ ...form, distribution: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            주당 과세대상 분배금
            <Input
              type="number"
              value={form.taxBase}
              onChange={(e) => onFormChange({ ...form, taxBase: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.held}
              onChange={(e) => onFormChange({ ...form, held: e.target.checked })}
            />
            현재 보유 중
          </label>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
