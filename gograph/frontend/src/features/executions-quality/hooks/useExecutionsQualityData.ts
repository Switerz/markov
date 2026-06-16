import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useRunsList } from "../../../app/hooks/useActiveRun";
import {
  api,
  type DataQualityRow,
  type ModelRun,
  type ModelRunCreatePayload,
  type ModelRunInputRow,
  type ModelRunLogRow,
  type ModelRunSummaryRow,
} from "../../../lib/api";
import { formatCompactBRL, formatNumber, formatPercent } from "../../../shared/format";
import { executionsQualityMock } from "../executions-quality.mock";
import type {
  ExecutionDetailsPanelData,
  ExecutionHistory,
  ExecutionHistoryRow,
  ExecutionStatusTone,
  ExecutionsQualityData,
} from "../types";

type RunDetail = {
  runId: number;
  summary: ModelRunSummaryRow | null;
  inputs: ModelRunInputRow[];
  logs: ModelRunLogRow[];
  dataQuality: DataQualityRow[];
};

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

function formatDuration(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return "-";
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1).replace(".", ",")}s`;
  return formatRuntime(seconds);
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

function detailFor(details: RunDetail[], run?: ModelRun): RunDetail | undefined {
  return run ? details.find((item) => item.runId === run.id) : undefined;
}

function detailsForRun(run?: ModelRun, detail?: RunDetail): ExecutionDetailsPanelData {
  if (!run) return executionsQualityMock.executionDetailsPanel;
  const badge = (detail?.summary?.confidence_label as ExecutionDetailsPanelData["confidenceBox"]["title"]) ? detail?.summary?.confidence_label : confidenceFor(run) ?? "—";
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
    inputs: (detail?.inputs ?? []).map((input) => ({
      source: input.source,
      query: input.query_name,
      rows: formatNumber(input.row_count),
      period:
        input.date_min && input.date_max
          ? `${input.date_min} - ${input.date_max}`
          : "-",
      hash: input.data_hash.slice(0, 12),
    })),
    outputs: [
      { label: "Canais", value: String(detail?.summary?.channel_count ?? "-") },
      { label: "Estados", value: String(detail?.summary?.state_count ?? "-") },
      { label: "Caminhos", value: String(detail?.summary?.path_count ?? "-") },
      { label: "Transições", value: String(detail?.summary?.transition_count ?? "-") },
    ],
    logs: (detail?.logs ?? []).map((log) => ({
      step: log.step,
      status: log.status,
      duration: formatDuration(log.duration_seconds),
      message: log.message ?? "-",
      createdAt: formatCreatedAt(log.created_at ?? null),
    })),
    notes: {
      title: "Retorno da API",
      value:
        run.error_message ||
        `${detail?.inputs.length ?? 0} entradas e ${detail?.logs.length ?? 0} logs carregados da API.`,
      action: "Atualizado",
    },
    confidenceBox: {
      title: `Confiança desta execução: ${badge}`,
      description:
        detail?.summary
          ? `Score ${formatPercent(detail.summary.confidence_score, 0)}; conversão modelada ${formatPercent(detail.summary.model_conversion_rate)} vs. observada ${
              detail.summary.observed_conversion_rate == null
                ? "-"
                : formatPercent(detail.summary.observed_conversion_rate)
            }.`
          : run.observed_conversion_rate == null
          ? "A execução ainda não possui conversão observada para calcular confiança."
          : `Conversão modelada ${formatPercent(run.model_conversion_rate)} vs. observada ${formatPercent(run.observed_conversion_rate)}.`,
      action: "Ver detalhes técnicos",
    },
  };
}

async function loadRunDetail(runId: number): Promise<RunDetail> {
  const [summary, inputs, logs, dataQuality] = await Promise.all([
    api.getSummary(runId).catch(() => null),
    api.getInputs(runId).catch(() => []),
    api.getLogs(runId).catch(() => []),
    api.getDataQuality(runId).then((res) => res.rows).catch(() => []),
  ]);
  return { runId, summary, inputs, logs, dataQuality };
}

function trustCenterFromDetail(run: ModelRun | undefined, detail: RunDetail | undefined) {
  if (!run || !detail?.summary) return executionsQualityMock.trustCenter;
  const summary = detail.summary;
  const checks = detail.dataQuality;
  const passed = checks.filter((check) => check.status === "pass").length;
  const critical = checks.filter((check) =>
    ["critical", "high"].includes((check.severity ?? "").toLowerCase()),
  );
  const calibration =
    summary.observed_conversion_rate && summary.observed_conversion_rate > 0
      ? Math.max(
          0,
          1 -
            Math.abs(summary.model_conversion_rate - summary.observed_conversion_rate) /
              summary.observed_conversion_rate,
        )
      : null;
  const averageQuality =
    checks.length > 0
      ? checks.reduce((sum, check) => sum + (check.score ?? (check.status === "pass" ? 1 : 0.5)), 0) /
        checks.length
      : null;

  return {
    ...executionsQualityMock.trustCenter,
    overallConfidence: {
      value: formatPercent(summary.confidence_score, 0),
      badge: summary.confidence_label as "Alta" | "Média" | "Baixa",
      delta: "Execução atual",
    },
    modelCalibration: [
      {
        label: "Conversão modelada vs. observada",
        value: calibration == null ? "-" : formatPercent(calibration, 0),
      },
      {
        label: "Taxa modelada",
        value: formatPercent(summary.model_conversion_rate),
      },
    ],
    dataQuality: [
      {
        label: "Qualidade dos dados",
        value: averageQuality == null ? "-" : formatPercent(averageQuality, 0),
      },
      {
        label: "Entradas registradas",
        value: String(detail.inputs.length),
      },
      {
        label: "Linhas auditadas",
        value: formatNumber(detail.inputs.reduce((sum, input) => sum + input.row_count, 0)),
      },
      ...checks.slice(0, 3).map((check) => ({
        label: check.check_name,
        value: check.score == null ? check.status : formatPercent(check.score, 0),
      })),
    ],
    alerts: {
      title: `Alertas críticos (${critical.length})`,
      items:
        critical.length > 0
          ? critical.map((check) => check.recommendation || check.detail || check.check_name)
          : ["Nenhum alerta crítico registrado para esta execução."],
      action: "Ver todos os alertas",
    },
    checks: {
      title: "Checks de qualidade",
      value: `${passed}/${checks.length}`,
      description:
        checks.length > 0
          ? `${passed} checks passaram; ${checks.length - passed} exigem atenção.`
          : "Nenhum check de qualidade registrado.",
      action: "Ver detalhes dos checks",
    },
  };
}

export function useExecutionsQualityData(): UseExecutionsQualityData {
  const runsQuery = useRunsList();
  const runs = runsQuery.data ?? [];
  const hasApiRows = runs.length > 0;
  const detailQueries = useQueries({
    queries: runs.map((run) => ({
      queryKey: ["executions-quality", "detail", run.id],
      queryFn: () => loadRunDetail(run.id),
      enabled: run.status === "completed",
      staleTime: 30_000,
    })),
  });
  const details = detailQueries
    .map((query) => query.data)
    .filter((detail): detail is RunDetail => detail != null);
  const firstRun = runs[0];
  const firstDetail = detailFor(details, firstRun);
  const criticalCount = firstDetail?.dataQuality.filter((check) =>
    ["critical", "high"].includes((check.severity ?? "").toLowerCase()),
  ).length;

  return useMemo(() => {
    const base: ExecutionsQualityData = hasApiRows
      ? {
          ...executionsQualityMock,
          summaryMetrics: executionsQualityMock.summaryMetrics.map((metric) =>
            metric.id === "totalExecutions"
              ? { ...metric, value: String(runs.length), delta: undefined }
              : metric.id === "lastConfidence" && firstDetail?.summary
                ? {
                    ...metric,
                    value: formatPercent(firstDetail.summary.confidence_score, 0),
                    badge: firstDetail.summary.confidence_label,
                    delta: undefined,
                  }
              : metric.id === "averageRuntime"
                ? {
                    ...metric,
                    value: formatRuntime(
                      runs.reduce((sum, run) => sum + (run.runtime_seconds || 0), 0) /
                        Math.max(runs.length, 1),
                    ),
                    delta: undefined,
                  }
              : metric.id === "criticalAlerts" && criticalCount != null
                ? { ...metric, value: String(criticalCount), subtitle: "Trust Center" }
              : metric,
          ),
          executionHistory: historyFromRuns(runs),
          trustCenter: trustCenterFromDetail(firstRun, firstDetail),
          executionDetailsPanel: detailsForRun(firstRun, firstDetail),
        }
      : executionsQualityMock;

    return {
      ...base,
      runs,
      isLoading: runsQuery.isLoading || detailQueries.some((query) => query.isLoading),
      isError: runsQuery.isError,
      errorMessage:
        runsQuery.error instanceof Error ? runsQuery.error.message : null,
      getDetailsForRun: (id?: string) =>
        detailsForRun(
          runs.find((run) => String(run.id) === id),
          detailFor(details, runs.find((run) => String(run.id) === id)),
        ),
      getDefaultsForRun: (id?: string) =>
        defaultsForRun(runs.find((run) => String(run.id) === id)),
    };
  }, [
    criticalCount,
    detailQueries,
    details,
    firstDetail,
    firstRun,
    hasApiRows,
    runs,
    runsQuery.error,
    runsQuery.isError,
    runsQuery.isLoading,
  ]);
}
