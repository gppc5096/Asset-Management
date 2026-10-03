"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataToolbar } from "@/components/shared/DataToolbar";
import { LoadErrorNotice } from "@/components/shared/LoadErrorNotice";
import { DistributionCharts } from "@/components/distribution/DistributionCharts";
import { DistributionPeriodFilter } from "@/components/distribution/DistributionPeriodFilter";
import { DistributionSummaryCards } from "@/components/distribution/DistributionSummaryCards";
import { DistributionTable } from "@/components/distribution/DistributionTable";
import { RecordFormDialog } from "@/components/distribution/RecordFormDialog";
import { useDistributionRecords } from "@/hooks/useDistributionRecords";
import { useCloudBackup } from "@/hooks/useCloudBackup";
import { useCsvTransfer } from "@/hooks/useCsvTransfer";
import { usePaginatedFilter } from "@/hooks/usePaginatedFilter";
import { distributionRecordsToCsv, parseDistributionCsv } from "@/lib/tax";
import {
  buildChangeById,
  filterRecords,
  listMonths,
  monthlyByTicker,
  monthlyNetVsTax,
  priceTrend,
  sumDistributionReceived,
  summarizeHeld,
  tickerShare,
  uniqueTickers,
} from "@/lib/distributionStats";
import {
  EMPTY_RECORD_FORM,
  buildRecordSubmission,
  formFromRecord,
  type RecordFormState,
} from "@/lib/distributionForm";
import { MSG_SAVE_FAILED, runSafely } from "@/lib/runSafely";
import { isDistributionDoc } from "@/lib/validate";
import { localDateString } from "@/lib/date";
import { buildTickerSuggestions } from "@/lib/tickerSuggestions";
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

export function DistributionAccountView({ category, title, subtitle }: Props) {
  const { data, loading, loadError, save } = useDistributionRecords(category);
  const [search, setSearch] = useState("");
  const [startMonth, setStartMonth] = useState<string>("");
  const [endMonth, setEndMonth] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<RecordFormState>(EMPTY_RECORD_FORM);

  const cloudBackup = useCloudBackup<DistributionDoc>(category, isDistributionDoc, save);
  const csvTransfer = useCsvTransfer<DistributionRecord>(
    distributionRecordsToCsv,
    (text) => parseDistributionCsv(text, category),
    "CSV 형식이 올바르지 않습니다 (거래일,종목명,주식수량,현주가,분배금,과세표준,보유여부 헤더 필요)"
  );

  const months = useMemo(() => listMonths(data.records), [data.records]);
  const effectiveStart = startMonth || months[0] || "";
  const effectiveEnd = endMonth || months[months.length - 1] || "";

  const filtered = useMemo(
    () => filterRecords(data.records, { start: effectiveStart, end: effectiveEnd, search }),
    [data.records, effectiveStart, effectiveEnd, search]
  );
  const changeById = useMemo(() => buildChangeById(data.records), [data.records]);

  const filterKey = `${effectiveStart}|${effectiveEnd}|${search}`;
  const { visible, visibleCount, showMore } = usePaginatedFilter(filtered, filterKey);

  const { totalQuantity, weightedAvgPrice } = useMemo(() => summarizeHeld(filtered), [filtered]);
  const distributionSum = useMemo(() => sumDistributionReceived(filtered), [filtered]);
  const tickers = useMemo(() => uniqueTickers(filtered), [filtered]);
  const charts = useMemo(
    () => ({
      monthlyByTicker: monthlyByTicker(filtered),
      priceTrend: priceTrend(filtered),
      tickerShare: tickerShare(filtered),
      monthlyNetVsTax: monthlyNetVsTax(filtered),
    }),
    [filtered]
  );

  // 자산 추가: 기록이 있는 가장 최근 2개월의 종목·수량을 추천 (이 페이지 계좌 유형의 문서)
  const { suggestions: tickerSuggestions, quantityByTicker } = useMemo(
    () => buildTickerSuggestions(data.records, form.date, editingId),
    [data.records, form.date, editingId]
  );

  // 직접 타이핑은 종목명만 갱신하고, 목록에서 선택했을 때만 수량도 채움
  function handleTickerSelect(ticker: string) {
    const quantity = quantityByTicker.get(ticker);
    setForm((prev) => ({
      ...prev,
      ticker,
      ...(quantity !== undefined ? { quantity: String(quantity) } : {}),
    }));
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_RECORD_FORM, date: localDateString() });
    setDialogOpen(true);
  }

  function openEdit(record: DistributionRecord) {
    setEditingId(record.id);
    setForm(formFromRecord(record));
    setDialogOpen(true);
  }

  const pendingDelete = data.records.find((r) => r.id === pendingDeleteId);

  async function handleDelete() {
    if (!pendingDeleteId) return;
    await save({
      ...data,
      records: data.records.filter((r) => r.id !== pendingDeleteId),
      updatedAt: new Date().toISOString(),
    });
    setPendingDeleteId(null);
    toast.success("삭제되었습니다");
  }

  async function handleSubmit() {
    const result = buildRecordSubmission({ form, category, editingId, existing: data.records });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    await save({
      ...data,
      records: result.records,
      updatedAt: new Date().toISOString(),
    });
    setDialogOpen(false);
    toast.success(result.isEdit ? "수정되었습니다" : "추가되었습니다");
  }

  async function confirmImport() {
    if (!csvTransfer.pendingImport) return;
    await save({
      ...data,
      records: csvTransfer.pendingImport,
      updatedAt: new Date().toISOString(),
    });
    csvTransfer.cancelImport();
    toast.success("가져오기 완료");
  }

  async function handleReset() {
    await save({ records: [], updatedAt: new Date().toISOString() });
    setResetDialogOpen(false);
    toast.success("초기화되었습니다");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {loadError && <LoadErrorNotice />}

      <DistributionPeriodFilter
        months={months}
        start={effectiveStart}
        end={effectiveEnd}
        onStartChange={setStartMonth}
        onEndChange={setEndMonth}
      />

      <DistributionSummaryCards
        totalQuantity={totalQuantity}
        weightedAvgPrice={weightedAvgPrice}
        distributionSum={distributionSum}
      />

      <DataToolbar
        loading={loading || loadError}
        onExport={() =>
          csvTransfer.exportCsv(
            data.records,
            `${localDateString()}-${CATEGORY_LABEL[category]}_내보내기.csv`
          )
        }
        onImport={csvTransfer.pickImportFile}
        onBackup={() => void cloudBackup.backup(data)}
        onRestore={() => void cloudBackup.requestRestore()}
        onReset={() => setResetDialogOpen(true)}
        onAdd={openAdd}
      />

      <Input
        placeholder="자산 검색 (종목명)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      <DistributionTable
        visible={visible}
        totalCount={filtered.length}
        visibleCount={visibleCount}
        changeById={changeById}
        loading={loading}
        onShowMore={showMore}
        onEdit={openEdit}
        onDelete={setPendingDeleteId}
      />

      <DistributionCharts
        tickers={tickers}
        monthlyByTicker={charts.monthlyByTicker}
        priceTrend={charts.priceTrend}
        tickerShare={charts.tickerShare}
        monthlyNetVsTax={charts.monthlyNetVsTax}
      />

      <RecordFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editingId !== null}
        form={form}
        onFormChange={setForm}
        tickerOptions={tickerSuggestions}
        onTickerChange={(ticker) => setForm((prev) => ({ ...prev, ticker }))}
        onTickerSelect={handleTickerSelect}
        onSubmit={() => void runSafely(handleSubmit, MSG_SAVE_FAILED)}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="항목 삭제"
        description={`${pendingDelete ? `${pendingDelete.ticker} · ${pendingDelete.date} 기록을 ` : "이 항목을 "}삭제합니다. 이 작업은 되돌릴 수 없습니다. 계속할까요?`}
        confirmLabel="삭제"
        onConfirm={() => void runSafely(handleDelete, MSG_SAVE_FAILED)}
      />

      <ConfirmDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        title="전체 데이터 초기화"
        description={`${title}의 모든 분배금 기록이 삭제됩니다. 이 작업은 되돌릴 수 없습니다. 계속할까요?`}
        confirmLabel="초기화"
        onConfirm={() => void runSafely(handleReset, MSG_SAVE_FAILED)}
      />

      <ConfirmDialog
        open={csvTransfer.pendingImport !== null}
        onOpenChange={(open) => !open && csvTransfer.cancelImport()}
        title="가져오기 확인"
        description={`현재 ${data.records.length}건을 가져온 ${csvTransfer.pendingImport?.length ?? 0}건으로 교체합니다. 이 작업은 되돌릴 수 없습니다. 계속할까요?`}
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
