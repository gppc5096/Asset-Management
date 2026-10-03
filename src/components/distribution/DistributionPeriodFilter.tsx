"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type Props = {
  months: string[];
  start: string;
  end: string;
  onStartChange: (month: string) => void;
  onEndChange: (month: string) => void;
};

/** 조회기간(시작월 → 종료월) 선택 카드. */
export function DistributionPeriodFilter({ months, start, end, onStartChange, onEndChange }: Props) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 pt-6">
        <span className="text-sm font-medium text-muted-foreground">조회기간</span>
        <Select value={start} onValueChange={(v) => onStartChange(v ?? "")}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="시작월" />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>→</span>
        <Select value={end} onValueChange={(v) => onEndChange(v ?? "")}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="종료월" />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
