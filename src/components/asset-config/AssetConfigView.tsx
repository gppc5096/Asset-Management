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
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { AssetFormDialog, EMPTY_ASSET_FORM } from "@/components/asset-config/AssetFormDialog";
import type { AssetFormState } from "@/components/asset-config/AssetFormDialog";
import { CashEditDialog } from "@/components/asset-config/CashEditDialog";
import type { CashFormState } from "@/components/asset-config/CashEditDialog";
import { useAssetConfigContext } from "@/components/providers/AssetConfigProvider";
import { useCloudBackup } from "@/hooks/useCloudBackup";
import { useCsvTransfer } from "@/hooks/useCsvTransfer";
import { usePaginatedFilter } from "@/hooks/usePaginatedFilter";
import { summarizeByCurrency, netPositions, holdingsToCsv, parseHoldingsCsv } from "@/lib/holdings";
import { isAssetConfig } from "@/lib/validate";
import { localDateString } from "@/lib/date";
import { formatKrw as krw } from "@/lib/format";
import { CHART_COLORS } from "@/lib/chartColors";
import { ACCOUNT_TYPES } from "@/lib/types";
import type { AccountType, AssetConfig, Holding } from "@/lib/types";

export function AssetConfigView() {
  const { data, loading, save } = useAssetConfigContext();
  const [search, setSearch] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>("전체");
  const [brokerFilter, setBrokerFilter] = useState<string>("전체");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [cashForm, setCashForm] = useState<CashFormState>({ krw: "0", usd: "0" });
  const [form, setForm] = useState<AssetFormState>(EMPTY_ASSET_FORM);

  const cloudBackup = useCloudBackup<AssetConfig>("asset-config", isAssetConfig, save);
  const csvTransfer = useCsvTransfer<Holding>(
    holdingsToCsv,
    parseHoldingsCsv,
    "CSV 형식이 올바르지 않습니다 (주식구분,국가,거래일,증권사,종목명,계좌번호,계좌유형,거래유형,분배주기,매입단가,수량,매수금액,매도금액,적용환율 헤더 필요)"
  );

  const brokers = useMemo(
    () => [...new Set(data.holdings.map((h) => h.broker))].filter(Boolean),
    [data.holdings]
  );

  // 자산 추가 모달: 국가 → 증권사 → (종목명/계좌번호) 계단식 필터링 옵션
  const formBrokerOptions = useMemo(
    () =>
      [
        ...new Set(
          data.holdings.filter((h) => h.country === form.country).map((h) => h.broker)
        ),
      ].filter(Boolean),
    [data.holdings, form.country]
  );
  const formTickerOptions = useMemo(
    () =>
      [
        ...new Set(
          data.holdings
            .filter(
              (h) =>
                h.country === form.country && (!form.broker || h.broker === form.broker)
            )
            .map((h) => h.ticker)
        ),
      ].filter(Boolean),
    [data.holdings, form.country, form.broker]
  );
  const formAccountNumberOptions = useMemo(
    () =>
      [
        ...new Set(
          data.holdings
            .filter(
              (h) =>
                h.country === form.country && (!form.broker || h.broker === form.broker)
            )
            .map((h) => h.accountNumber)
        ),
      ].filter(Boolean),
    [data.holdings, form.country, form.broker]
  );

  // 계좌번호 → 계좌유형 매핑 (같은 계좌는 항상 같은 계좌유형이라는 전제)
  const accountTypeByAccountNumber = useMemo(() => {
    const map = new Map<string, AccountType>();
    for (const h of data.holdings) map.set(h.accountNumber, h.accountType);
    return map;
  }, [data.holdings]);

  const filtered = useMemo(() => {
    return data.holdings
      .filter((h) => {
        if (accountTypeFilter !== "전체" && h.accountType !== accountTypeFilter)
          return false;
        if (brokerFilter !== "전체" && h.broker !== brokerFilter) return false;
        if (search && !h.ticker.toLowerCase().includes(search.toLowerCase()))
          return false;
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [data.holdings, accountTypeFilter, brokerFilter, search]);

  const filterKey = `${accountTypeFilter}|${brokerFilter}|${search}`;
  const { visible, visibleCount, showMore } = usePaginatedFilter(filtered, filterKey);

  const summary = useMemo(
    () => summarizeByCurrency(data.holdings, data.cash, data.exchangeRate),
    [data.holdings, data.cash, data.exchangeRate]
  );

  const positions = useMemo(() => netPositions(data.holdings), [data.holdings]);

  const currencyPie = [
    { name: "KRW 자산", value: summary.krwAssets },
    { name: "USD 자산 (KRW환산)", value: summary.usdAssets * data.exchangeRate.rate },
  ];

  const accountTypePie = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of positions) {
      map.set(p.accountType, (map.get(p.accountType) ?? 0) + p.value);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [positions]);

  const tickerShareByCountry = useMemo(() => {
    const krw: Record<string, number> = {};
    const usd: Record<string, number> = {};
    for (const p of positions) {
      const target = p.country === "KOR" ? krw : usd;
      target[p.ticker] = (target[p.ticker] ?? 0) + p.netQuantity;
    }
    return { krw, usd };
  }, [positions]);

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_ASSET_FORM, date: localDateString() });
    setDialogOpen(true);
  }

  function openEdit(h: Holding) {
    setEditingId(h.id);
    setForm({
      ticker: h.ticker,
      date: h.date,
      broker: h.broker,
      accountNumber: h.accountNumber,
      accountType: h.accountType,
      assetType: h.assetType,
      country: h.country,
      tradeType: h.tradeType,
      quantity: String(h.quantity),
      unitPrice: String(h.unitPrice),
      appliedRate: String(h.appliedRate),
      distributionCycle: h.distributionCycle,
    });
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("이 항목을 삭제할까요?")) return;
    await save({
      ...data,
      holdings: data.holdings.filter((h) => h.id !== id),
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
    const unitPrice = form.unitPrice.trim() === "" ? 0 : Number(form.unitPrice);
    const appliedRate = form.appliedRate.trim() === "" ? 0 : Number(form.appliedRate);
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0 ||
      !Number.isFinite(appliedRate) ||
      appliedRate < 0
    ) {
      toast.error("수량·단가·환율은 올바른 숫자여야 합니다");
      return;
    }
    const amount = quantity * unitPrice;
    const holding: Holding = {
      id: editingId ?? crypto.randomUUID(),
      ticker: form.ticker,
      date: form.date,
      broker: form.broker,
      accountNumber: form.accountNumber,
      accountType: form.accountType,
      assetType: form.assetType,
      country: form.country,
      tradeType: form.tradeType,
      quantity,
      unitPrice,
      buyAmount: form.tradeType === "매수" ? amount : 0,
      sellAmount: form.tradeType === "매도" ? amount : 0,
      appliedRate,
      distributionCycle: form.distributionCycle,
    };
    const nextHoldings = editingId
      ? data.holdings.map((h) => (h.id === editingId ? holding : h))
      : [...data.holdings, holding];
    await save({ ...data, holdings: nextHoldings, updatedAt: new Date().toISOString() });
    setDialogOpen(false);
    toast.success(editingId ? "수정되었습니다" : "추가되었습니다");
  }

  function openCashEdit() {
    setCashForm({ krw: String(data.cash.krw), usd: String(data.cash.usd) });
    setCashDialogOpen(true);
  }

  async function handleCashSubmit() {
    const krwValue = cashForm.krw.trim() === "" ? NaN : Number(cashForm.krw);
    const usdValue = cashForm.usd.trim() === "" ? NaN : Number(cashForm.usd);
    if (!Number.isFinite(krwValue) || krwValue < 0 || !Number.isFinite(usdValue) || usdValue < 0) {
      toast.error("KRW/USD 현금은 0 이상의 숫자여야 합니다");
      return;
    }
    await save({
      ...data,
      cash: {
        krw: krwValue,
        usd: usdValue,
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });
    setCashDialogOpen(false);
    toast.success("현금 잔고가 수정되었습니다");
  }

  async function confirmImport() {
    if (!csvTransfer.pendingImport) return;
    await save({
      ...data,
      holdings: csvTransfer.pendingImport,
      updatedAt: new Date().toISOString(),
    });
    csvTransfer.cancelImport();
    toast.success("가져오기 완료");
  }

  async function handleReset() {
    await save({
      holdings: [],
      cash: { krw: 0, usd: 0, updatedAt: new Date().toISOString() },
      exchangeRate: data.exchangeRate,
      updatedAt: new Date().toISOString(),
    });
    setResetDialogOpen(false);
    toast.success("초기화되었습니다");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold">전체 자산관리 현황</h1>
        <p className="text-sm text-muted-foreground">보유한 자산 데이터를 체계적으로 관리합니다.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              총 자산 (추정)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{krw(summary.totalKrw)}</p>
            <p className="text-xs text-muted-foreground">
              적용환율 (USD/KRW) {krw(data.exchangeRate.rate)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              USD 자산
            </CardTitle>
            <Button variant="ghost" size="icon-sm" onClick={openCashEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              ${summary.usdAssets.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              주식 ${summary.usdStockValue.toLocaleString()} + 현금 $
              {data.cash.usd.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              KRW 자산
            </CardTitle>
            <Button variant="ghost" size="icon-sm" onClick={openCashEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{krw(summary.krwAssets)}</p>
            <p className="text-xs text-muted-foreground">
              주식 {krw(summary.krwStockValue)} + 현금 {krw(data.cash.krw)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={accountTypeFilter} onValueChange={(v) => setAccountTypeFilter(v ?? "전체")}>
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
        <Select value={brokerFilter} onValueChange={(v) => setBrokerFilter(v ?? "전체")}>
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
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            csvTransfer.exportCsv(data.holdings, `${localDateString()}-자산관리_내보내기.csv`)
          }
        >
          <Download className="mr-1 h-4 w-4" /> 내보내기
        </Button>
        <Button variant="outline" size="sm" onClick={csvTransfer.pickImportFile} disabled={loading}>
          <Upload className="mr-1 h-4 w-4" /> 가져오기
        </Button>
        <Button variant="outline" size="sm" onClick={() => void cloudBackup.backup(data)} disabled={loading}>
          <CloudUpload className="mr-1 h-4 w-4" /> 클라우드 백업
        </Button>
        <Button variant="outline" size="sm" onClick={() => void cloudBackup.requestRestore()} disabled={loading}>
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

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>주식구분</TableHead>
                <TableHead>국가</TableHead>
                <TableHead>거래일</TableHead>
                <TableHead>증권사</TableHead>
                <TableHead>종목명</TableHead>
                <TableHead>계좌번호</TableHead>
                <TableHead>계좌유형</TableHead>
                <TableHead>거래</TableHead>
                <TableHead>배당주기</TableHead>
                <TableHead>수량</TableHead>
                <TableHead>매수금액</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{h.assetType}</TableCell>
                  <TableCell>{h.country}</TableCell>
                  <TableCell>{h.date}</TableCell>
                  <TableCell>{h.broker}</TableCell>
                  <TableCell>{h.ticker}</TableCell>
                  <TableCell>{h.accountNumber}</TableCell>
                  <TableCell>{h.accountType}</TableCell>
                  <TableCell>{h.tradeType}</TableCell>
                  <TableCell>{h.distributionCycle}</TableCell>
                  <TableCell>{h.quantity.toLocaleString()}</TableCell>
                  <TableCell>{h.buyAmount.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(h)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleDelete(h.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground">
                    {loading ? "불러오는 중..." : "데이터가 없습니다"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {visibleCount < filtered.length && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" size="sm" onClick={showMore}>
                더보기 ({visible.length} / {filtered.length})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">통화별 자산 구성 (KRW/USD 환산)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={currencyPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {currencyPie.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => krw(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">통화별 종목 보유수량</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="mb-2 font-medium text-muted-foreground">KRW 종목</p>
              {Object.entries(tickerShareByCountry.krw).map(([t, q]) => (
                <div key={t} className="flex justify-between border-b py-1">
                  <span className="truncate">{t}</span>
                  <span>{q.toLocaleString()}주</span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 font-medium text-muted-foreground">USD 종목</p>
              {Object.entries(tickerShareByCountry.usd).map(([t, q]) => (
                <div key={t} className="flex justify-between border-b py-1">
                  <span className="truncate">{t}</span>
                  <span>{q.toLocaleString()}주</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">계좌유형별 투자 비중</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={accountTypePie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {accountTypePie.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => krw(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">종목별 보유 비중 (현재 평가금액 기준)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={positions} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="ticker" width={140} fontSize={10} />
                <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                <Bar dataKey="value" fill="#f5a524" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <AssetFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editingId !== null}
        form={form}
        onFormChange={setForm}
        brokerOptions={formBrokerOptions}
        tickerOptions={formTickerOptions}
        accountNumberOptions={formAccountNumberOptions}
        accountTypeByAccountNumber={accountTypeByAccountNumber}
        onSubmit={() => void handleSubmit()}
      />

      <CashEditDialog
        open={cashDialogOpen}
        onOpenChange={setCashDialogOpen}
        form={cashForm}
        onFormChange={setCashForm}
        onSubmit={() => void handleCashSubmit()}
      />

      <ConfirmDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        title="전체 자산 데이터 초기화"
        description="보유 종목, 현금 잔고가 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다. 계속할까요?"
        confirmLabel="초기화"
        onConfirm={() => void handleReset()}
      />

      <ConfirmDialog
        open={csvTransfer.pendingImport !== null}
        onOpenChange={(open) => !open && csvTransfer.cancelImport()}
        title="가져오기 확인"
        description={`현재 ${data.holdings.length}건을 가져온 ${csvTransfer.pendingImport?.length ?? 0}건으로 교체합니다. 이 작업은 되돌릴 수 없습니다. 계속할까요?`}
        confirmLabel="가져오기"
        onConfirm={() => void confirmImport()}
      />

      <ConfirmDialog
        open={cloudBackup.pendingRestore !== null}
        onOpenChange={(open) => !open && cloudBackup.cancelRestore()}
        title="클라우드 복원 확인"
        description={`가장 최근 백업(${cloudBackup.pendingRestore?.id})으로 현재 데이터를 덮어씁니다. 이 작업은 되돌릴 수 없습니다. 계속할까요?`}
        confirmLabel="복원"
        onConfirm={() => void cloudBackup.confirmRestore()}
      />
    </div>
  );
}
