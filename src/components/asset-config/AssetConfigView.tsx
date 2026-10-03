"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataToolbar } from "@/components/shared/DataToolbar";
import { LoadErrorNotice } from "@/components/shared/LoadErrorNotice";
import { AssetFormDialog } from "@/components/asset-config/AssetFormDialog";
import { CashEditDialog } from "@/components/asset-config/CashEditDialog";
import type { CashFormState } from "@/components/asset-config/CashEditDialog";
import { ExchangeRateEditDialog } from "@/components/asset-config/ExchangeRateEditDialog";
import { AssetSummaryCards } from "@/components/asset-config/AssetSummaryCards";
import { AssetFilters } from "@/components/asset-config/AssetFilters";
import { AssetTable } from "@/components/asset-config/AssetTable";
import { AssetCharts } from "@/components/asset-config/AssetCharts";
import { useAssetConfigContext } from "@/components/providers/AssetConfigProvider";
import { useCloudBackup } from "@/hooks/useCloudBackup";
import { useCsvTransfer } from "@/hooks/useCsvTransfer";
import { usePaginatedFilter } from "@/hooks/usePaginatedFilter";
import { summarizeByCurrency, netPositions, holdingsToCsv, parseHoldingsCsv } from "@/lib/holdings";
import {
  EMPTY_ASSET_FORM,
  buildAssetSubmission,
  formFromHolding,
  parseCashForm,
  parseRateForm,
  type AssetFormState,
} from "@/lib/assetForm";
import {
  accountNumberOptionsFor,
  accountTypeMap,
  accountTypePieData,
  brokerOptionsForCountry,
  currencyPieData,
  filterHoldings,
  listBrokers,
  tickerOptionsFor,
  tickerShareByCountry as buildTickerShareByCountry,
} from "@/lib/assetStats";
import { MSG_SAVE_FAILED, runSafely } from "@/lib/runSafely";
import { MSG_RATE_FETCH_FAILED, fetchUsdKrwRate } from "@/lib/exchangeRate";
import { isAssetConfig } from "@/lib/validate";
import { localDateString } from "@/lib/date";
import type { AssetConfig, Holding } from "@/lib/types";

export function AssetConfigView() {
  const { data, loading, loadError, save } = useAssetConfigContext();
  const [search, setSearch] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>("전체");
  const [brokerFilter, setBrokerFilter] = useState<string>("전체");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [cashForm, setCashForm] = useState<CashFormState>({ krw: "0", usd: "0" });
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [rateForm, setRateForm] = useState("0");
  // 입력칸 값의 출처: 자동 조회로 채운 값이면 "auto"(+안내 문구), 사용자가 직접 입력/수정하면 "manual"
  const [rateSource, setRateSource] = useState<"manual" | "auto">("manual");
  const [rateFetchInfo, setRateFetchInfo] = useState<string | null>(null);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [form, setForm] = useState<AssetFormState>(EMPTY_ASSET_FORM);

  const cloudBackup = useCloudBackup<AssetConfig>("asset-config", isAssetConfig, save);
  const csvTransfer = useCsvTransfer<Holding>(
    holdingsToCsv,
    parseHoldingsCsv,
    "CSV 형식이 올바르지 않습니다 (주식구분,국가,거래일,증권사,종목명,계좌번호,계좌유형,거래유형,분배주기,매입단가,수량,매수금액,매도금액,적용환율 헤더 필요)"
  );

  const brokers = useMemo(() => listBrokers(data.holdings), [data.holdings]);

  // 자산 추가 모달: 국가 → 증권사 → (종목명/계좌번호) 계단식 필터링 옵션
  const formBrokerOptions = useMemo(
    () => brokerOptionsForCountry(data.holdings, form.country),
    [data.holdings, form.country]
  );
  const formTickerOptions = useMemo(
    () => tickerOptionsFor(data.holdings, form.country, form.broker),
    [data.holdings, form.country, form.broker]
  );
  const formAccountNumberOptions = useMemo(
    () => accountNumberOptionsFor(data.holdings, form.country, form.broker),
    [data.holdings, form.country, form.broker]
  );
  const accountTypeByAccountNumber = useMemo(() => accountTypeMap(data.holdings), [data.holdings]);

  const filtered = useMemo(
    () =>
      filterHoldings(data.holdings, {
        accountType: accountTypeFilter,
        broker: brokerFilter,
        search,
      }),
    [data.holdings, accountTypeFilter, brokerFilter, search]
  );

  const filterKey = `${accountTypeFilter}|${brokerFilter}|${search}`;
  const { visible, visibleCount, showMore } = usePaginatedFilter(filtered, filterKey);

  const summary = useMemo(
    () => summarizeByCurrency(data.holdings, data.cash, data.exchangeRate),
    [data.holdings, data.cash, data.exchangeRate]
  );

  const positions = useMemo(() => netPositions(data.holdings), [data.holdings]);
  const currencyPie = currencyPieData(summary);
  const accountTypePie = useMemo(() => accountTypePieData(positions), [positions]);
  const tickerShareByCountry = useMemo(() => buildTickerShareByCountry(positions), [positions]);

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_ASSET_FORM, date: localDateString() });
    setDialogOpen(true);
  }

  function openEdit(h: Holding) {
    setEditingId(h.id);
    setForm(formFromHolding(h));
    setDialogOpen(true);
  }

  const pendingDelete = data.holdings.find((h) => h.id === pendingDeleteId);

  async function handleDelete() {
    if (!pendingDeleteId) return;
    await save({
      ...data,
      holdings: data.holdings.filter((h) => h.id !== pendingDeleteId),
      updatedAt: new Date().toISOString(),
    });
    setPendingDeleteId(null);
    toast.success("삭제되었습니다");
  }

  async function handleSubmit() {
    const result = buildAssetSubmission({ form, editingId, existing: data.holdings });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    await save({ ...data, holdings: result.holdings, updatedAt: new Date().toISOString() });
    setDialogOpen(false);
    toast.success(result.isEdit ? "수정되었습니다" : "추가되었습니다");
  }

  function openCashEdit() {
    setCashForm({ krw: String(data.cash.krw), usd: String(data.cash.usd) });
    setCashDialogOpen(true);
  }

  function openRateEdit() {
    setRateForm(String(summary.appliedUsdRate || data.exchangeRate.rate || ""));
    setRateSource("manual");
    setRateFetchInfo(null);
    setRateDialogOpen(true);
  }

  function handleRateInput(value: string) {
    setRateForm(value);
    setRateSource("manual");
    setRateFetchInfo(null);
  }

  /** 현재 환율을 조회해 입력칸에 채운다. 저장은 하지 않는다(사용자가 확인 후 저장). */
  async function handleFetchRate() {
    setFetchingRate(true);
    try {
      await runSafely(async () => {
        const fetched = await fetchUsdKrwRate();
        setRateForm(String(fetched.rate));
        setRateSource("auto");
        setRateFetchInfo(
          `${fetched.provider}${fetched.asOf ? ` · ${fetched.asOf} 기준` : ""} 환율을 불러왔습니다. 확인 후 저장하세요.`
        );
      }, MSG_RATE_FETCH_FAILED);
    } finally {
      setFetchingRate(false);
    }
  }

  async function handleCashSubmit() {
    const result = parseCashForm(cashForm);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    await save({
      ...data,
      cash: {
        krw: result.krw,
        usd: result.usd,
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });
    setCashDialogOpen(false);
    toast.success("현금 잔고가 수정되었습니다");
  }

  async function handleRateSubmit() {
    const result = parseRateForm(rateForm);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    await save({
      ...data,
      exchangeRate: {
        rate: result.rate,
        source: rateSource,
        fetchedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });
    setRateDialogOpen(false);
    toast.success("적용환율이 저장되었습니다");
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

      {loadError && <LoadErrorNotice />}

      <AssetSummaryCards
        summary={summary}
        cash={data.cash}
        onEditRate={openRateEdit}
        onEditCash={openCashEdit}
      />

      <AssetFilters
        accountType={accountTypeFilter}
        broker={brokerFilter}
        search={search}
        brokers={brokers}
        onAccountTypeChange={setAccountTypeFilter}
        onBrokerChange={setBrokerFilter}
        onSearchChange={setSearch}
      />

      <DataToolbar
        loading={loading || loadError}
        onExport={() =>
          csvTransfer.exportCsv(data.holdings, `${localDateString()}-자산관리_내보내기.csv`)
        }
        onImport={csvTransfer.pickImportFile}
        onBackup={() => void cloudBackup.backup(data)}
        onRestore={() => void cloudBackup.requestRestore()}
        onReset={() => setResetDialogOpen(true)}
        onAdd={openAdd}
      />

      <AssetTable
        visible={visible}
        totalCount={filtered.length}
        visibleCount={visibleCount}
        loading={loading}
        onShowMore={showMore}
        onEdit={openEdit}
        onDelete={setPendingDeleteId}
      />

      <AssetCharts
        currencyPie={currencyPie}
        accountTypePie={accountTypePie}
        positions={positions}
        tickerShareByCountry={tickerShareByCountry}
      />

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
        onSubmit={() => void runSafely(handleSubmit, MSG_SAVE_FAILED)}
      />

      <CashEditDialog
        open={cashDialogOpen}
        onOpenChange={setCashDialogOpen}
        form={cashForm}
        onFormChange={setCashForm}
        onSubmit={() => void runSafely(handleCashSubmit, MSG_SAVE_FAILED)}
      />

      <ExchangeRateEditDialog
        open={rateDialogOpen}
        onOpenChange={setRateDialogOpen}
        rate={rateForm}
        onRateChange={handleRateInput}
        onSubmit={() => void runSafely(handleRateSubmit, MSG_SAVE_FAILED)}
        onFetch={() => void handleFetchRate()}
        fetching={fetchingRate}
        fetchInfo={rateFetchInfo}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="항목 삭제"
        description={`${pendingDelete ? `${pendingDelete.ticker} · ${pendingDelete.date} 거래를 ` : "이 항목을 "}삭제합니다. 이 작업은 되돌릴 수 없습니다. 계속할까요?`}
        confirmLabel="삭제"
        onConfirm={() => void runSafely(handleDelete, MSG_SAVE_FAILED)}
      />

      <ConfirmDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        title="전체 자산 데이터 초기화"
        description="보유 종목, 현금 잔고가 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다. 계속할까요?"
        confirmLabel="초기화"
        onConfirm={() => void runSafely(handleReset, MSG_SAVE_FAILED)}
      />

      <ConfirmDialog
        open={csvTransfer.pendingImport !== null}
        onOpenChange={(open) => !open && csvTransfer.cancelImport()}
        title="가져오기 확인"
        description={`현재 ${data.holdings.length}건을 가져온 ${csvTransfer.pendingImport?.length ?? 0}건으로 교체합니다. 이 작업은 되돌릴 수 없습니다. 계속할까요?`}
        confirmLabel="가져오기"
        onConfirm={() => void runSafely(confirmImport, MSG_SAVE_FAILED)}
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
