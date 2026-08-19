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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { ACCOUNT_TYPES } from "@/lib/types";
import type { AccountType, AssetType, Country, DistributionCycle, TradeType } from "@/lib/types";

export type AssetFormState = {
  ticker: string;
  date: string;
  broker: string;
  accountNumber: string;
  accountType: AccountType;
  assetType: AssetType;
  country: Country;
  tradeType: TradeType;
  quantity: string;
  unitPrice: string;
  appliedRate: string;
  distributionCycle: DistributionCycle;
};

export const EMPTY_ASSET_FORM: AssetFormState = {
  ticker: "",
  date: "",
  broker: "",
  accountNumber: "",
  accountType: "일반계좌",
  assetType: "ETF주식",
  country: "KOR",
  tradeType: "매수",
  quantity: "",
  unitPrice: "",
  appliedRate: "0",
  distributionCycle: "없음",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: AssetFormState;
  onFormChange: (form: AssetFormState) => void;
  brokerOptions: string[];
  tickerOptions: string[];
  accountNumberOptions: string[];
  accountTypeByAccountNumber: Map<string, AccountType>;
  onSubmit: () => void;
};

export function AssetFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  onFormChange,
  brokerOptions,
  tickerOptions,
  accountNumberOptions,
  accountTypeByAccountNumber,
  onSubmit,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "자산 수정" : "자산 추가"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            자산구분
            <Select
              value={form.assetType}
              onValueChange={(v) =>
                onFormChange({ ...form, assetType: (v as AssetType) ?? form.assetType })
              }
            >
              <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ETF주식">ETF주식</SelectItem>
                <SelectItem value="개별주식">개별주식</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            국가
            <Select
              value={form.country}
              onValueChange={(v) => {
                const country = (v as Country) ?? form.country;
                // 국가가 바뀌면 더 이상 맞지 않을 수 있는 하위 필드를 초기화
                onFormChange({ ...form, country, broker: "", ticker: "", accountNumber: "" });
              }}
            >
              <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="KOR">KOR</SelectItem>
                <SelectItem value="USA">USA</SelectItem>
              </SelectContent>
            </Select>
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
            증권사
            <Combobox
              value={form.broker}
              options={brokerOptions}
              placeholder="증권사 선택 또는 입력"
              onChange={(v) => {
                // 증권사가 바뀌면 그 증권사에 속하지 않을 수 있는 종목명/계좌번호를 초기화
                onFormChange({ ...form, broker: v, ticker: "", accountNumber: "" });
              }}
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-sm">
            종목명
            <Combobox
              value={form.ticker}
              options={tickerOptions}
              placeholder="종목명 선택 또는 입력"
              onChange={(v) => onFormChange({ ...form, ticker: v })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            계좌번호
            <Combobox
              value={form.accountNumber}
              options={accountNumberOptions}
              placeholder="계좌번호 선택 또는 입력"
              onChange={(v) => {
                // 기존 계좌번호와 정확히 일치하면 계좌유형을 자동으로 채움 (직접 다시 바꿀 수 있음)
                const matchedType = accountTypeByAccountNumber.get(v);
                onFormChange({
                  ...form,
                  accountNumber: v,
                  ...(matchedType ? { accountType: matchedType } : {}),
                });
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            계좌유형
            <Select
              value={form.accountType}
              onValueChange={(v) =>
                onFormChange({ ...form, accountType: (v as AccountType) ?? form.accountType })
              }
            >
              <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            거래
            <Select
              value={form.tradeType}
              onValueChange={(v) =>
                onFormChange({ ...form, tradeType: (v as TradeType) ?? form.tradeType })
              }
            >
              <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="매수">매수</SelectItem>
                <SelectItem value="매도">매도</SelectItem>
              </SelectContent>
            </Select>
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
            단가
            <Input
              type="number"
              value={form.unitPrice}
              onChange={(e) => onFormChange({ ...form, unitPrice: e.target.value })}
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
