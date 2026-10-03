"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ACCOUNT_TYPES } from "@/lib/types";

type Props = {
  accountType: string;
  broker: string;
  search: string;
  brokers: string[];
  onAccountTypeChange: (value: string) => void;
  onBrokerChange: (value: string) => void;
  onSearchChange: (value: string) => void;
};

/** 계좌유형·증권사 선택과 종목 검색 입력. */
export function AssetFilters({
  accountType,
  broker,
  search,
  brokers,
  onAccountTypeChange,
  onBrokerChange,
  onSearchChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={accountType} onValueChange={(v) => onAccountTypeChange(v ?? "전체")}>
        <SelectTrigger size="sm">
          <SelectValue placeholder="계좌유형" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="전체">전체</SelectItem>
          {ACCOUNT_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={broker} onValueChange={(v) => onBrokerChange(v ?? "전체")}>
        <SelectTrigger size="sm">
          <SelectValue placeholder="증권사" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="전체">전체</SelectItem>
          {brokers.map((b) => (
            <SelectItem key={b} value={b}>
              {b}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="자산 검색 (종목명)"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-xs"
      />
    </div>
  );
}
