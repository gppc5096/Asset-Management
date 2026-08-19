"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Download,
  Upload,
  CloudUpload,
  CloudDownload,
  RotateCcw,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useDistributionRecords } from "@/hooks/useDistributionRecords";
import {
  calcDistributionChange,
  calcPriceChange,
  computeDistributionAmounts,
  distributionRecordsToCsv,
  parseDistributionCsv,
} from "@/lib/tax";
import { monthKey } from "@/lib/aggregate";
import { db } from "@/lib/firebaseConfig";
import { useAuth } from "@/components/providers/AuthProvider";
import { isDistributionDoc } from "@/lib/validate";
import { localDateString, previousMonthKey } from "@/lib/date";
import type { DistributionCategory, DistributionDoc, DistributionRecord } from "@/lib/types";

type Props = {
  category: DistributionCategory;
  title: string;
  subtitle: string;
};

const CATEGORY_LABEL: Record<DistributionCategory, string> = {
  special: "특별계좌",
  general: "일반계좌",
  "tax-free": "비과세계좌",
};

const TICKER_COLORS = [
  "#7c3aed",
  "#f97316",
  "#0ea5e9",
  "#22c55e",
  "#ef4444",
  "#eab308",
  "#ec4899",
  "#14b8a6",
];

function colorFor(index: number) {
  return TICKER_COLORS[index % TICKER_COLORS.length];
}

function krw(n: number) {
  return `₩${Math.round(n).toLocaleString()}`;
}

type FormState = {
  ticker: string;
  date: string;
  quantity: string;
  price: string;
  distribution: string;
  taxBase: string;
  held: boolean;
};

const EMPTY_FORM: FormState = {
  ticker: "",
  date: "",
  quantity: "",
  price: "",
  distribution: "",
  taxBase: "",
  held: true,
};

export function DistributionAccountView({ category, title, subtitle }: Props) {
  const { user } = useAuth();
  const { data, loading, save } = useDistributionRecords(category);
  const [search, setSearch] = useState("");
  const [startMonth, setStartMonth] = useState<string>("");
  const [endMonth, setEndMonth] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<DistributionRecord[] | null>(null);
  const [pendingRestore, setPendingRestore] = useState<{ id: string; data: DistributionDoc } | null>(
    null
  );
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const months = useMemo(() => {
    const set = new Set(data.records.map((r) => monthKey(r.date)));
    return [...set].sort();
  }, [data.records]);

  const effectiveStart = startMonth || months[0] || "";
  const effectiveEnd = endMonth || months[months.length - 1] || "";

  const filtered = useMemo(() => {
    return data.records
      .filter((r) => {
        const mk = monthKey(r.date);
        if (effectiveStart && mk < effectiveStart) return false;
        if (effectiveEnd && mk > effectiveEnd) return false;
        if (search && !r.ticker.toLowerCase().includes(search.toLowerCase()))
          return false;
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [data.records, effectiveStart, effectiveEnd, search]);

  // 저장된 등락값이 0이어도, 동일 종목 전달 대비로 화면에서 재계산
  const changeById = useMemo(() => {
    const map = new Map<
      string,
      { priceChange: number; distributionChange: number }
    >();
    for (const r of data.records) {
      map.set(r.id, {
        priceChange: calcPriceChange(r, data.records),
        distributionChange: calcDistributionChange(r, data.records),
      });
    }
    return map;
  }, [data.records]);

  const filterKey = `${effectiveStart}|${effectiveEnd}|${search}`;
  const [visibleCount, setVisibleCount] = useState(10);
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setVisibleCount(10);
  }
  const visible = filtered.slice(0, visibleCount);

  const latestPerTicker = useMemo(() => {
    const map = new Map<string, DistributionRecord>();
    for (const r of filtered) {
      const cur = map.get(r.ticker);
      if (!cur || cur.date < r.date) map.set(r.ticker, r);
    }
    // 종목별 최신 기록이 매도(보유여부="무")면 더 이상 보유 중이 아니므로 합계에서 제외
    return [...map.values()].filter((r) => r.held);
  }, [filtered]);

  const totalQuantity = latestPerTicker.reduce((a, r) => a + r.quantity, 0);
  const weightedAvgPrice =
    totalQuantity > 0
      ? Math.round(
          latestPerTicker.reduce((a, r) => a + r.price * r.quantity, 0) /
            totalQuantity
        )
      : 0;
  const distributionSum = filtered.reduce(
    (a, r) => a + r.distributionReceived,
    0
  );

  const tickers = useMemo(
    () => [...new Set(filtered.map((r) => r.ticker))],
    [filtered]
  );

  // 자산 추가: 테이블 기록 중 달력상 지난달에 포함된 종목 → 최신 수량 매핑
  const lastMonthTickerQuantity = useMemo(() => {
    const lastMonth = previousMonthKey();
    const latestByTicker = new Map<string, DistributionRecord>();
    for (const r of data.records) {
      if (monthKey(r.date) !== lastMonth || !r.ticker) continue;
      const cur = latestByTicker.get(r.ticker);
      if (!cur || cur.date < r.date) latestByTicker.set(r.ticker, r);
    }
    const quantityByTicker = new Map<string, number>();
    for (const [ticker, r] of latestByTicker) {
      quantityByTicker.set(ticker, r.quantity);
    }
    return quantityByTicker;
  }, [data.records]);

  const lastMonthTickerOptions = useMemo(
    () =>
      [...lastMonthTickerQuantity.keys()].sort((a, b) =>
        a.localeCompare(b, "ko")
      ),
    [lastMonthTickerQuantity]
  );

  const tickerFieldOptions = useMemo(() => {
    // 수정 진입 시점의 종목만 지난달 목록에 없어도 선택지에 유지
    if (editingTicker && !lastMonthTickerOptions.includes(editingTicker)) {
      return [editingTicker, ...lastMonthTickerOptions].sort((a, b) =>
        a.localeCompare(b, "ko")
      );
    }
    return lastMonthTickerOptions;
  }, [editingTicker, lastMonthTickerOptions]);

  function handleTickerChange(ticker: string) {
    const lastMonthQty = lastMonthTickerQuantity.get(ticker);
    setForm((prev) => ({
      ...prev,
      ticker,
      // 지난달 동일 종목을 선택한 경우에만 수량 자동 반영
      ...(lastMonthQty !== undefined ? { quantity: String(lastMonthQty) } : {}),
    }));
  }

  const monthlyByTicker = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const r of filtered) {
      const mk = monthKey(r.date);
      const row = map.get(mk) ?? {};
      row[r.ticker] = (row[r.ticker] ?? 0) + r.total;
      map.set(mk, row);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, row]) => ({ month, ...row }));
  }, [filtered]);

  const priceTrend = useMemo(() => {
    const dateSet = [...new Set(filtered.map((r) => r.date))].sort();
    return dateSet.map((date) => {
      const row: Record<string, number | string> = { date };
      for (const r of filtered.filter((x) => x.date === date)) {
        row[r.ticker] = r.price;
      }
      return row;
    });
  }, [filtered]);

  const tickerShare = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      map.set(
        r.ticker,
        (map.get(r.ticker) ?? 0) + r.distributionReceived
      );
    }
    const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
    const row: Record<string, number> = {};
    for (const [ticker, v] of map.entries()) {
      row[ticker] = Math.round((v / total) * 1000) / 10;
    }
    return [row];
  }, [filtered]);

  const monthlyNetVsTax = useMemo(() => {
    const map = new Map<string, { total: number; taxAmount: number }>();
    for (const r of filtered) {
      const mk = monthKey(r.date);
      const row = map.get(mk) ?? { total: 0, taxAmount: 0 };
      row.total += r.total;
      row.taxAmount += r.taxAmount;
      map.set(mk, row);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, v]) => ({ month, ...v }));
  }, [filtered]);

  function openAdd() {
    setEditingId(null);
    setEditingTicker(null);
    setForm({ ...EMPTY_FORM, date: localDateString() });
    setDialogOpen(true);
  }

  function openEdit(record: DistributionRecord) {
    setEditingId(record.id);
    setEditingTicker(record.ticker);
    setForm({
      ticker: record.ticker,
      date: record.date,
      quantity: String(record.quantity),
      price: String(record.price),
      distribution: String(record.distribution),
      taxBase: String(record.taxBase),
      held: record.held,
    });
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("이 항목을 삭제할까요?")) return;
    await save({
      ...data,
      records: data.records.filter((r) => r.id !== id),
      updatedAt: new Date().toISOString(),
    });
    toast.success("삭제되었습니다");
  }

  async function handleSubmit() {
    if (!form.ticker.trim() || !form.date || form.quantity.trim() === "") {
      toast.error("종목명·거래일·수량을 입력해주세요");
      return;
    }
    const quantity = Number(form.quantity);
    const price = form.price.trim() === "" ? 0 : Number(form.price);
    const distribution = form.distribution.trim() === "" ? 0 : Number(form.distribution);
    const taxBase = form.taxBase.trim() === "" ? 0 : Number(form.taxBase);
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isFinite(distribution) ||
      distribution < 0 ||
      !Number.isFinite(taxBase) ||
      taxBase < 0
    ) {
      toast.error("수량·현주가·분배금은 올바른 숫자여야 합니다");
      return;
    }
    const amounts = computeDistributionAmounts(
      { quantity, distribution, taxBase },
      category
    );
    const recordId = editingId ?? crypto.randomUUID();
    const draft: DistributionRecord = {
      id: recordId,
      ticker: form.ticker,
      date: form.date,
      quantity,
      price,
      distribution,
      held: form.held,
      priceChange: 0,
      distributionChange: 0,
      ...amounts,
      taxBase,
    };
    const nextRecords = editingId
      ? data.records.map((r) => (r.id === editingId ? draft : r))
      : [...data.records, draft];
    const record: DistributionRecord = {
      ...draft,
      priceChange: calcPriceChange(draft, nextRecords),
      distributionChange: calcDistributionChange(draft, nextRecords),
    };
    const recordsWithChange = nextRecords.map((r) =>
      r.id === record.id ? record : r
    );
    await save({
      ...data,
      records: recordsWithChange,
      updatedAt: new Date().toISOString(),
    });
    setDialogOpen(false);
    toast.success(editingId ? "수정되었습니다" : "추가되었습니다");
  }

  function handleExport() {
    const csv = distributionRecordsToCsv(data.records);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${localDateString()}-${CATEGORY_LABEL[category]}_내보내기.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const records = parseDistributionCsv(text, category);
      if (!records) {
        toast.error(
          "CSV 형식이 올바르지 않습니다 (거래일,종목명,주식수량,현주가,분배금,과세표준,보유여부 헤더 필요)"
        );
        return;
      }
      if (records.length === 0) {
        toast.error("가져올 수 있는 유효한 행이 없습니다");
        return;
      }
      setPendingImport(records);
    };
    input.click();
  }

  async function confirmImport() {
    if (!pendingImport) return;
    await save({ ...data, records: pendingImport, updatedAt: new Date().toISOString() });
    setPendingImport(null);
    toast.success("가져오기 완료");
  }

  async function handleReset() {
    await save({ records: [], updatedAt: new Date().toISOString() });
    setResetDialogOpen(false);
    toast.success("초기화되었습니다");
  }

  async function handleCloudBackup() {
    if (!user) return;
    const backupId = `${category}-backup-${new Date().toISOString()}`;
    await setDoc(doc(db, "users", user.uid, "backups", backupId), data);
    toast.success("클라우드에 백업되었습니다", {
      style: { background: "#c4f5e4" },
    });
  }

  async function handleCloudRestore() {
    if (!user) return;
    const snap = await getDocs(collection(db, "users", user.uid, "backups"));
    const backups = snap.docs
      .filter((d) => d.id.startsWith(`${category}-backup-`))
      .sort((a, b) => (a.id < b.id ? 1 : -1));
    if (backups.length === 0) {
      toast.error("복원할 백업이 없습니다");
      return;
    }
    const latest = backups[0];
    const latestData = latest.data();
    if (!isDistributionDoc(latestData)) {
      toast.error("백업 데이터 형식이 올바르지 않습니다");
      return;
    }
    setPendingRestore({ id: latest.id, data: latestData });
  }

  async function confirmRestore() {
    if (!pendingRestore) return;
    await save(pendingRestore.data);
    setPendingRestore(null);
    toast.success("복원되었습니다", {
      style: { background: "#c4f5e4" },
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-neutral-500">{subtitle}</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <span className="text-sm font-medium text-neutral-500">조회기간</span>
          <Select
            value={effectiveStart}
            onValueChange={(v) => setStartMonth(v ?? "")}
          >
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
          <Select
            value={effectiveEnd}
            onValueChange={(v) => setEndMonth(v ?? "")}
          >
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">
              주식수량 합계
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalQuantity.toLocaleString()} 주</p>
            <p className="text-xs text-neutral-400">* 종목별 최신 데이터 기준, 보유중인 종목만</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">
              평균 주식 단가 (가중평균)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{weightedAvgPrice.toLocaleString()} 원</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">
              분배금 합계
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{krw(distributionSum)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1 h-4 w-4" /> 내보내기
        </Button>
        <Button variant="outline" size="sm" onClick={handleImport} disabled={loading}>
          <Upload className="mr-1 h-4 w-4" /> 가져오기
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleCloudBackup()} disabled={loading}>
          <CloudUpload className="mr-1 h-4 w-4" /> 클라우드 백업
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleCloudRestore()} disabled={loading}>
          <CloudDownload className="mr-1 h-4 w-4" /> 클라우드 복원
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setResetDialogOpen(true)}
          disabled={loading}
        >
          <RotateCcw className="mr-1 h-4 w-4" /> 초기화
        </Button>
        <Button size="sm" onClick={openAdd} className="ml-auto" disabled={loading}>
          <Plus className="mr-1 h-4 w-4" /> 자산 추가
        </Button>
      </div>

      <Input
        placeholder="자산 검색 (종목명)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>거래일</TableHead>
                <TableHead>종목명</TableHead>
                <TableHead>주식수량</TableHead>
                <TableHead>현주가</TableHead>
                <TableHead>주가등락</TableHead>
                <TableHead>분배금</TableHead>
                <TableHead>분배금등락</TableHead>
                <TableHead>분배금총액</TableHead>
                <TableHead>과세표준</TableHead>
                <TableHead>과세분배액</TableHead>
                <TableHead>과세금액</TableHead>
                <TableHead>합계</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => {
                const { priceChange, distributionChange } = changeById.get(
                  r.id
                ) ?? { priceChange: 0, distributionChange: 0 };
                return (
                <TableRow key={r.id}>
                  <TableCell>{r.date}</TableCell>
                  <TableCell
                    className={r.held ? "" : "text-neutral-400 line-through"}
                  >
                    {r.ticker}
                  </TableCell>
                  <TableCell>{r.quantity.toLocaleString()}</TableCell>
                  <TableCell>{r.price.toLocaleString()}</TableCell>
                  <TableCell
                    className={
                      priceChange > 0
                        ? "text-red-500"
                        : priceChange < 0
                          ? "text-blue-500"
                          : "text-neutral-400"
                    }
                  >
                    {priceChange > 0 ? "+" : ""}
                    {priceChange.toLocaleString()}
                  </TableCell>
                  <TableCell>{r.distribution.toLocaleString()}</TableCell>
                  <TableCell
                    className={
                      distributionChange > 0
                        ? "text-red-500"
                        : distributionChange < 0
                          ? "text-blue-500"
                          : "text-neutral-400"
                    }
                  >
                    {distributionChange > 0 ? "+" : ""}
                    {distributionChange.toLocaleString()}
                  </TableCell>
                  <TableCell>{r.distributionReceived.toLocaleString()}</TableCell>
                  <TableCell>{r.taxBase.toLocaleString()}</TableCell>
                  <TableCell>{r.taxedDistribution.toLocaleString()}</TableCell>
                  <TableCell>{r.taxAmount.toLocaleString()}</TableCell>
                  <TableCell className="font-medium">
                    {r.total.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.held ? "default" : "secondary"}>
                      {r.held ? "보유" : "매도"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleDelete(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={14} className="text-center text-neutral-400">
                    {loading ? "불러오는 중..." : "데이터가 없습니다"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {visibleCount < filtered.length && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((c) => c + 10)}
              >
                더보기 ({visible.length} / {filtered.length})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">월별 분배금 수령액 추이 (종목별)</CardTitle>
          </CardHeader>
          <CardContent className="h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={monthlyByTicker}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                {tickers.map((t, i) => (
                  <Bar key={t} name={t} dataKey={(row) => row[t]} stackId="a" fill={colorFor(i)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">종목별 현주가 추이</CardTitle>
          </CardHeader>
          <CardContent className="h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={priceTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                {tickers.map((t, i) => (
                  <Line
                    key={t}
                    name={t}
                    type="monotone"
                    dataKey={(row) => row[t]}
                    stroke={colorFor(i)}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">종목별 분배금 비중 (조회 기간 전체)</CardTitle>
          </CardHeader>
          <CardContent className="h-40 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={tickerShare} layout="vertical">
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis type="category" dataKey={() => ""} hide />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
                {tickers.map((t, i) => (
                  <Bar key={t} name={t} dataKey={(row) => row[t]} stackId="a" fill={colorFor(i)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">월별 순수령액 vs 과세금액</CardTitle>
          </CardHeader>
          <CardContent className="h-40 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={monthlyNetVsTax}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="순수령액" fill="#7c3aed" />
                <Bar dataKey="taxAmount" name="과세금액" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "자산 수정" : "자산 추가"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1 text-sm">
              종목명
              <Combobox
                value={form.ticker}
                onChange={handleTickerChange}
                options={tickerFieldOptions}
                placeholder="지난달 종목 선택 또는 입력"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              거래일
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              수량
              <Input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              현주가
              <Input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              주당 분배금
              <Input
                type="number"
                value={form.distribution}
                onChange={(e) =>
                  setForm({ ...form, distribution: e.target.value })
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              주당 과세대상 분배금
              <Input
                type="number"
                value={form.taxBase}
                onChange={(e) => setForm({ ...form, taxBase: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.held}
                onChange={(e) => setForm({ ...form, held: e.target.checked })}
              />
              현재 보유 중
            </label>
          </div>
          <DialogFooter>
            <Button onClick={() => void handleSubmit()}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>전체 데이터 초기화</DialogTitle>
            <DialogDescription>
              {title}의 모든 분배금 기록이 삭제됩니다. 이 작업은 되돌릴 수 없습니다. 계속할까요?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={() => void handleReset()}>
              초기화
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingImport !== null} onOpenChange={(open) => !open && setPendingImport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>가져오기 확인</DialogTitle>
            <DialogDescription>
              현재 {data.records.length}건을 가져온 {pendingImport?.length ?? 0}건으로
              교체합니다. 이 작업은 되돌릴 수 없습니다. 계속할까요?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingImport(null)}>
              취소
            </Button>
            <Button variant="destructive" onClick={() => void confirmImport()}>
              가져오기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingRestore !== null}
        onOpenChange={(open) => !open && setPendingRestore(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>클라우드 복원 확인</DialogTitle>
            <DialogDescription>
              가장 최근 백업({pendingRestore?.id})으로 현재 데이터를 덮어씁니다. 이 작업은
              되돌릴 수 없습니다. 계속할까요?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRestore(null)}>
              취소
            </Button>
            <Button variant="destructive" onClick={() => void confirmRestore()}>
              복원
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
