import { useMemo } from "react";
import { useRunsList } from "../../../app/hooks/useActiveRun";
import type { ModelRun, ModelRunCreatePayload } from "../../../lib/api";
import { formatCompactBRL, formatPercent } from "../../../shared/format";
import { executionsQualityMock } from "../executions-quality.mock";
import type {
  ExecutionDetailsPanelData,
  ExecutionHistory,
  ExecutionHistoryRow,
  ExecutionStatusTone,
  ExecutionsQualityData,
} from "../types";

export type UseExecutionsQualityData = ExecutionsQualityData & {
  runs: ModelRun[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  getDetailsForRun: (id?: string) => ExecutionDetailsPanelData;
  getDefaultsForRun: (id?: string) => Partial<ModelRunCreatePayload> | undefined;
};

const statusLabel: Record<string, { label: string; tone: ExecutionStatusTone }> = {
  completed: { label: "Concluído", tone: "green" },
  running: { label: "Em processamento", tone: "blue" },
  pending: { label: "Em processamento", tone: "blue" },
  failed: { label: "Erro", tone: "red" },
  error: { label: "Erro", tone: "red" },
};

const dateOnly = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatPeriod(run: ModelRun): string {
  return `${dateOnly.format(new Date(`${run.start_date}T00:00:00`))} - ${dateOnly.format(
    new Date(`${run.end_date}T00:00:00`),
  )}`;
}

function formatCreatedAt(value: string | null): string {
  if (!value) return "-";
  return dateTime.format(new Date(value));
}

function formatRuntime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function confidenceFor(run: ModelRun): ExecutionHistoryRow["confidenceBadge"] {
  if (run.observed_conversion_rate == null || run.observed_conversion_rate <= 0) {
    return undefined;
  }
  const diff = Math.abs(run.model_conversion_rate - run.observed_conversion_rate);
  const relativeDiff = diff / run.observed_conversion_rate;
  if (relativeDiff <= 0.08) return "Alta";
  if (relativeDiff <= 0.18) return "Média";
  return "Baixa";
}

function confidenceValue(run: ModelRun): string {
  if (run.observed_conversion_rate == null || run.observed_conversion_rate <= 0) {
    return "-";
  }
  const diff = Math.abs(run.model_conversion_rate - run.observed_conversion_rate);
  const relativeDiff = diff / run.observed_conversion_rate;
  const score = Math.max(0, Math.min(1, 1 - relativeDiff));
  return formatPercent(score, 0);
}

function toHistoryRow(run: ModelRun, selected: boolean): ExecutionHistoryRow {
  const status = statusLabel[run.status] ?? { label: run.status || "Atenção", tone: "orange" };
  return {
    id: String(run.id),
    period: formatPeriod(run),
    status: status.label,
    statusTone: status.tone,
    revenue: formatCompactBRL(run.total_revenue ?? 0),
    observedConversion:
      run.observed_conversion_rate == null
        ? "-"
        : formatPercent(run.observed_conversion_rate),
    modeledConversion: formatPercent(run.model_conversion_rate ?? 0),
    confidence: confidenceValue(run),
    confidenceBadge: confidenceFor(run),
    runtime: formatRuntime(run.runtime_seconds),
    createdBy: "API",
    createdAt: formatCreatedAt(run.created_at),
    selected,
  };
}

function historyFromRuns(runs: ModelRun[]): ExecutionHistory {
  const rows = runs.map((run, index) => toHistoryRow(run, index === 0));
  return {
    ...executionsQualityMock.executionHistory,
    rows,
    pagination: {
      summary: `Mostrando ${rows.length === 0 ? 0 : 1} a ${Math.min(rows.length, 20)} de ${rows.length} execuções`,
      pages: rows.length > 20 ? [1, 2] : [1],
    },
  };
}

function numberParam(run: ModelRun, key: string): number | undefined {
  const value = run.parameters[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringParam(run: ModelRun, key: string): string | undefined {
  const value = run.parameters[key];
  return typeof value === "string" ? value : undefined;
}

function nullableNumberParam(run: ModelRun, key: string): number | null | undefined {
  if (!(key in run.parameters)) return undefined;
  const value = run.parameters[key];
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function defaultsForRun(run?: ModelRun): Partial<ModelRunCreatePayload> | undefined {
  if (!run) return undefined;
  return {
    start_date: run.start_date,
    end_date: run.end_date,
    lookback_days: nullableNumberParam(run, "lookback_days"),
    decay_lambda: numberParam(run, "decay_lambda"),
    non_conv_sample_pct: numberParam(run, "non_conv_sample_pct"),
    non_conv_scale: nullableNumberParam(run, "non_conv_scale"),
    shapley_samples: numberParam(run, "shapley_samples"),
    db_plausible: numberParam(run, "db_plausible"),
    db_datamart: nullableNumberParam(run, "db_datamart"),
    batch_mode: stringParam(run, "batch_mode") as ModelRunCreatePayload["batch_mode"] | undefined,
    batch_days: numberParam(run, "batch_days"),
  };
}

function detailsForRun(run?: ModelRun): ExecutionDetailsPanelData {
  if (!run) return executionsQualityMock.executionDetailsPanel;
  const badge = confidenceFor(run) ?? "—";
  const params = defaultsForRun(run);
  return {
    ...executionsQualityMock.executionDetailsPanel,
    title: `Execução #${run.id}`,
    period: formatPeriod(run),
    status: statusLabel[run.status]?.label ?? run.status,
    createdAt: formatCreatedAt(run.created_at),
    createdBy: "API",
    modelParameters: [
      { label: "Lookback (dias)", value: String(params?.lookback_days ?? "-") },
      { label: "Decay lambda", value: String(params?.decay_lambda ?? "-") },
      { label: "Amostras Shapley", value: String(params?.shapley_samples ?? "-") },
      { label: "Amostra não-conversão", value: `${params?.non_conv_sample_pct ?? "-"}%` },
      { label: "Escala não-conversão", value: String(params?.non_conv_scale ?? "-") },
      { label: "DB Plausible", value: String(params?.db_plausible ?? "-") },
      { label: "DB Datamart", value: String(params?.db_datamart ?? "-") },
      { label: "Modo de lote", value: String(params?.batch_mode ?? "-") },
      { label: "Dias por lote", value: String(params?.batch_days ?? "-") },
    ],
    notes: {
      title: "Retorno da API",
      value: run.error_message || "Execução carregada de /model-runs.",
      action: "Atualizado",
    },
    confidenceBox: {
      title: `Confiança desta execução: ${badge}`,
      description:
        run.observed_conversion_rate == null
          ? "A execução ainda não possui conversão observada para calcular confiança."
          : `Conversão modelada ${formatPercent(run.model_conversion_rate)} vs. observada ${formatPercent(run.observed_conversion_rate)}.`,
      action: "Ver detalhes técnicos",
    },
  };
}

export function useExecutionsQualityData(): UseExecutionsQualityData {
  const runsQuery = useRunsList();
  const runs = runsQuery.data ?? [];
  const hasApiRows = runs.length > 0;

  return useMemo(() => {
    const base: ExecutionsQualityData = hasApiRows
      ? {
          ...executionsQualityMock,
          summaryMetrics: executionsQualityMock.summaryMetrics.map((metric) =>
            metric.id === "totalExecutions"
              ? { ...metric, value: String(runs.length), delta: undefined }
              : metric,
          ),
          executionHistory: historyFromRuns(runs),
          executionDetailsPanel: detailsForRun(runs[0]),
        }
      : executionsQualityMock;

    return {
      ...base,
      runs,
      isLoading: runsQuery.isLoading,
      isError: runsQuery.isError,
      errorMessage:
        runsQuery.error instanceof Error ? runsQuery.error.message : null,
      getDetailsForRun: (id?: string) =>
        detailsForRun(runs.find((run) => String(run.id) === id)),
      getDefaultsForRun: (id?: string) =>
        defaultsForRun(runs.find((run) => String(run.id) === id)),
    };
  }, [hasApiRows, runs, runsQuery.error, runsQuery.isError, runsQuery.isLoading]);
}
