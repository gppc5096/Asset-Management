"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  /** 값 옆에 흐리게 표시되는 보조 텍스트 (예: 수량) */
  detail?: string;
  /** 오른쪽에 표시되는 배지 텍스트 (예: "이미 등록됨") */
  badge?: string;
};

type ComboboxProps = {
  value: string;
  /** 직접 타이핑할 때 호출 */
  onChange: (value: string) => void;
  /** 목록에서 항목을 골랐을 때 호출. 없으면 onChange로 대체 */
  onSelect?: (value: string) => void;
  options: (string | ComboboxOption)[];
  placeholder?: string;
  className?: string;
};

/** 자동완성 + 자유 입력 허용 콤보박스. options는 목록일 뿐 강제 선택은 아님. */
export function Combobox({
  value,
  onChange,
  onSelect,
  options,
  placeholder,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalized: ComboboxOption[] = options.map((o) =>
    typeof o === "string" ? { value: o } : o
  );
  const filtered = value.trim()
    ? normalized.filter((o) =>
        o.value.toLowerCase().includes(value.trim().toLowerCase())
      )
    : normalized;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {filtered.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                opt.value === value && "bg-accent/60"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                (onSelect ?? onChange)(opt.value);
                setOpen(false);
              }}
            >
              <span className="truncate">{opt.value}</span>
              {opt.detail && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {opt.detail}
                </span>
              )}
              {opt.badge && (
                <Badge variant="secondary" className="ml-auto">
                  {opt.badge}
                </Badge>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
