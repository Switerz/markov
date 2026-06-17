import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { TopBar } from "../../app/TopBar";
import { Button, useToast } from "../../shared/ui";
import { Plus, Save, EllipsisVertical, Calendar, Download } from "lucide-react";
import { NewRunDialog } from "../../app/dialogs/NewRunDialog";
import { ScenarioBuilderForm } from "./components/ScenarioBuilderForm";
import { BaselineScenarioComparison } from "./components/BaselineScenarioComparison";
import { AttributionRedistributionWaterfall } from "./components/AttributionRedistributionWaterfall";
import { ScenarioInsightsPanel } from "./components/ScenarioInsightsPanel";
import { ScenarioComparisonTable } from "./components/ScenarioComparisonTable";
import { SavedScenariosList } from "./components/SavedScenariosList";
import { useExperimentsData } from "./hooks/useExperimentsData";
import {
  useAnalyzeScenario,
  useChannelOptions,
  useCreateScenario,
  useDeleteScenario,
  useScenarioCompare,
  useScenarios,
} from "./hooks/useScenarios";
import { useActiveRun } from "../../app/hooks/useActiveRun";
import { downloadCsv, formatCompactBRL, formatPercent, todayIso } from "../../shared/format";
import type { ModelRun, Scenario, ScenarioCompareResponse } from "../../lib/api";
import type { ScenarioComparisonTable as ScenarioComparisonTableData } from "./types";
import styles from "./ExperimentsPage.module.css";

export type AppliedScenario = {
  name: string;
  intensityPct: number;
};

export function ExperimentsPage() {
  const data = useExperimentsData();
  const activeRun = useActiveRun();
  const runId = activeRun?.id;
  const scenariosQuery = useScenarios(runId);
  const channelOptionsQuery = useChannelOptions(runId);
  const createScenario = useCreateScenario(runId);
  const analyzeScenario = useAnalyzeScenario(runId);
  const deleteScenario = useDeleteScenario(runId);
  const toast = useToast();
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [scenarioFlash, setScenarioFlash] = useState(false);
  const [appliedScenario, setAppliedScenario] =
    useState<AppliedScenario | null>(null);
  const [busyScenarioId, setBusyScenarioId] = useState<number | null>(null);
  const savedScenarios = scenariosQuery.data ?? [];
  const scenarioIds = savedScenarios.map((scenario) => scenario.id);
  const compareQuery = useScenarioCompare(runId, scenarioIds);
  const scenarioComparisonTable =
    activeRun != null
      ? buildScenarioComparisonTable(
          data.scenarioComparisonTable,
          savedScenarios,
          activeRun,
          compareQuery.data,
        )
      : data.scenarioComparisonTable;

  function exportPanel() {
    const rows = scenarioComparisonTable.rows.map((r) => ({
      scenario: r.scenario,
      description: r.description,
      conversion_probability: r.conversionProbability,
      conversion_delta: r.conversionDelta ?? "",
      revenue: r.revenue,
      revenue_delta: r.revenueDelta ?? "",
      investment: r.investment,
      investment_delta: r.investmentDelta ?? "",
      roas: r.roas,
      roas_delta: r.roasDelta ?? "",
      impact: r.impact,
      impact_delta: r.impactDelta ?? "",
    }));
    downloadCsv(`experimentos-cenarios-${todayIso()}.csv`, rows);
    toast.push("Exportação iniciada", "green");
  }

  async function applyScenario(values: {
    channel: string;
    action: string;
    intensity: number;
    period: string;
    actionType: Scenario["action_type"];
  }) {
    if (runId == null) {
      toast.push("Nenhuma execução ativa para salvar o cenário", "red");
      return;
    }

    const name = `${actionTypeLabel(values.actionType)} ${values.channel}`;
    try {
      const saved = await createScenario.mutateAsync({
        name,
        description: `${actionTypeLabel(values.actionType)} · ${values.period || "período atual"}`,
        action_type: values.actionType,
        channel: values.channel,
        intensity_pct: values.intensity,
        nodes: [],
        edges: [],
        path_channels: [values.channel],
      });
      setBusyScenarioId(saved.id);
      const analysis = await analyzeScenario.mutateAsync(saved.id);
      setAppliedScenario({ name, intensityPct: values.intensity });
      toast.push(
        `Cenário analisado — versão ${analysis.code_version ?? "-"}`,
        "green",
      );
      setScenarioFlash(true);
      window.setTimeout(() => setScenarioFlash(false), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro desconhecido";
      toast.push(`Falha ao salvar cenário: ${msg}`, "red");
    } finally {
      setBusyScenarioId(null);
    }
  }

  async function reanalyzeSavedScenario(scenarioId: number) {
    setBusyScenarioId(scenarioId);
    try {
      const analysis = await analyzeScenario.mutateAsync(scenarioId);
      toast.push(`Análise atualizada — versão ${analysis.code_version ?? "-"}`, "green");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro desconhecido";
      toast.push(`Falha ao reanalisar: ${msg}`, "red");
    } finally {
      setBusyScenarioId(null);
    }
  }

  async function removeSavedScenario(scenarioId: number) {
    try {
      await deleteScenario.mutateAsync(scenarioId);
      toast.push("Cenário excluído", "green");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro desconhecido";
      toast.push(`Falha ao excluir: ${msg}`, "red");
    }
  }

  return (
    <>
      <TopBar
        title={data.screen.title}
        subtitle={data.screen.subtitle}
        actions={
          <>
            <span className={styles.execContext}>
              <Calendar size={14} aria-hidden />
              <span>
                {activeRun ? "Execução" : data.topBar.executionContext.label}:{" "}
                <strong>{activeRun ? `#${activeRun.id}` : data.topBar.executionContext.value}</strong>
              </span>
            </span>
            <Button
              variant="primary"
              iconLeft={<Plus size={16} />}
              onClick={() => setNewRunOpen(true)}
            >
              Novo cenário
            </Button>
            <Button
              variant="secondary"
              iconLeft={<Save size={16} />}
              onClick={() =>
                toast.push(
                  "Cenários são salvos automaticamente",
                  "green",
                )
              }
            >
              Salvar experimento
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="icon" aria-label="Mais opções">
                  <EllipsisVertical size={16} />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className={styles.menu}
                >
                  <DropdownMenu.Item
                    className={styles.menuItem}
                    onSelect={exportPanel}
                  >
                    <Download size={14} aria-hidden /> Exportar este painel
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </>
        }
      />
      <NewRunDialog open={newRunOpen} onOpenChange={setNewRunOpen} />
      <div className={styles.page}>
        <div className={styles.grid}>
          <section className={styles.left}>
            <ScenarioBuilderForm
              builder={data.scenarioBuilder}
              onApply={applyScenario}
              channelOptions={channelOptionsQuery.data}
              loading={createScenario.isPending || analyzeScenario.isPending}
            />
            <div
              className={
                scenarioFlash
                  ? `${styles.flashWrap} ${styles.flashActive}`
                  : styles.flashWrap
              }
            >
              <BaselineScenarioComparison
                data={data.baselineVsScenario}
                overrides={appliedScenario ?? undefined}
              />
            </div>
            <AttributionRedistributionWaterfall
              redistribution={data.redistributionChart}
              intensityPct={appliedScenario?.intensityPct}
            />
            <ScenarioComparisonTable table={scenarioComparisonTable} />
          </section>
          <aside className={styles.right}>
            <SavedScenariosList
              scenarios={savedScenarios}
              loading={scenariosQuery.isLoading}
              busyScenarioId={busyScenarioId}
              onAnalyze={reanalyzeSavedScenario}
              onDelete={removeSavedScenario}
            />
            <ScenarioInsightsPanel
              insights={data.scenarioInsights}
              onAction={(label) => toast.push(`${label} — em breve`, "blue")}
            />
          </aside>
        </div>
      </div>
    </>
  );
}

function buildScenarioComparisonTable(
  base: ScenarioComparisonTableData,
  scenarios: Scenario[],
  run: ModelRun,
  compare?: ScenarioCompareResponse,
): ScenarioComparisonTableData {
  if (compare?.items?.length) {
    return buildComparedScenarioTable(base, scenarios, run, compare);
  }

  const baselineConv = run.model_conversion_rate ?? run.observed_conversion_rate ?? null;
  const baselineRevenue = run.total_revenue ?? 0;
  const baselineSpend = run.total_spend ?? 0;
  const baselineRoas = baselineSpend > 0 ? baselineRevenue / baselineSpend : null;

  return {
    ...base,
    title: "Comparativo de cenários persistidos",
    rows: [
      {
        scenario: "Baseline (atual)",
        description: `Execução #${run.id}`,
        conversionProbability:
          baselineConv != null ? formatPercent(baselineConv, 2) : "-",
        revenue: formatCompactBRL(baselineRevenue),
        investment: baselineSpend > 0 ? formatCompactBRL(baselineSpend) : "-",
        roas: baselineRoas != null ? `${baselineRoas.toFixed(2).replace(".", ",")}x` : "-",
        impact: "Referência",
        tone: "neutral",
      },
      ...scenarios.map((scenario) => scenarioToTableRow(scenario, run)),
    ],
  };
}

function buildComparedScenarioTable(
  base: ScenarioComparisonTableData,
  scenarios: Scenario[],
  run: ModelRun,
  compare: ScenarioCompareResponse,
): ScenarioComparisonTableData {
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const baseline = compare.items.find((item) => item.source === "baseline");
  const rows = compare.items.map((item, index) => {
    const scenario = item.scenario_id ? scenarioById.get(item.scenario_id) : undefined;
    const isBaseline = item.source === "baseline";
    const delta =
      compare.items.length === 2 && index === 1 ? compare.delta : undefined;
    const revenueDelta =
      delta?.expected_revenue_delta != null
        ? formatSignedCurrency(delta.expected_revenue_delta)
        : item.expected_revenue != null && baseline?.expected_revenue != null && !isBaseline
          ? formatSignedCurrency(item.expected_revenue - baseline.expected_revenue)
          : undefined;
    const conversionDelta =
      delta?.composite_conversion_delta != null
        ? formatSignedPercentPoints(delta.composite_conversion_delta)
        : item.composite_conversion_probability != null &&
            baseline?.composite_conversion_probability != null &&
            !isBaseline
          ? formatSignedPercentPoints(
              item.composite_conversion_probability -
                baseline.composite_conversion_probability,
            )
          : undefined;

    return {
      scenario: item.name,
      description:
        scenario?.description ??
        (isBaseline ? `Execução #${run.id}` : item.warnings[0] ?? "Cenário salvo"),
      conversionProbability:
        item.composite_conversion_probability != null
          ? formatPercent(item.composite_conversion_probability, 2)
          : "Pendente",
      conversionDelta,
      revenue:
        item.expected_revenue != null ? formatCompactBRL(item.expected_revenue) : "-",
      revenueDelta,
      investment:
        scenario?.intensity_pct != null && run.total_spend
          ? formatCompactBRL(run.total_spend * (scenario.intensity_pct / 100))
          : isBaseline && run.total_spend
            ? formatCompactBRL(run.total_spend)
            : "-",
      roas:
        item.expected_revenue != null && run.total_spend
          ? `${(item.expected_revenue / run.total_spend).toFixed(2).replace(".", ",")}x`
          : "-",
      impact:
        item.confidence_score != null
          ? `Confiança ${formatPercent(item.confidence_score, 0)}`
          : isBaseline
            ? "Referência"
            : item.warnings[0] ?? "Aguardando análise",
      impactDelta:
        delta?.confidence_delta != null
          ? formatSignedPercentPoints(delta.confidence_delta)
          : undefined,
      tone: isBaseline ? "neutral" : item.confidence_score != null ? "green" : "orange",
    } as const;
  });

  return {
    ...base,
    title: "Comparativo de cenários persistidos",
    rows,
  };
}

function scenarioToTableRow(scenario: Scenario, run: ModelRun) {
  const analysis = scenario.analysis;
  const baselineConv = run.model_conversion_rate ?? run.observed_conversion_rate ?? null;
  const scenarioConv = analysis?.composite_conversion_probability ?? null;
  const scenarioRevenue = analysis?.expected_revenue ?? null;
  const estimatedSpend =
    scenario.intensity_pct != null && run.total_spend
      ? run.total_spend * (scenario.intensity_pct / 100)
      : null;
  const roas =
    scenarioRevenue != null && estimatedSpend != null && estimatedSpend > 0
      ? scenarioRevenue / estimatedSpend
      : null;

  return {
    scenario: scenario.name,
    description: scenario.description ?? actionTypeLabel(scenario.action_type),
    conversionProbability:
      scenarioConv != null ? formatPercent(scenarioConv, 2) : "Pendente",
    conversionDelta:
      scenarioConv != null && baselineConv != null
        ? formatSignedPercentPoints(scenarioConv - baselineConv)
        : undefined,
    revenue: scenarioRevenue != null ? formatCompactBRL(scenarioRevenue) : "-",
    revenueDelta:
      scenarioRevenue != null
        ? formatSignedCurrency(scenarioRevenue - (run.total_revenue ?? 0))
        : undefined,
    investment: estimatedSpend != null ? formatCompactBRL(estimatedSpend) : "-",
    roas: roas != null ? `${roas.toFixed(2).replace(".", ",")}x` : "-",
    impact:
      analysis?.confidence_score != null
        ? `Confiança ${formatPercent(analysis.confidence_score, 0)}`
        : "Aguardando análise",
    tone: analysis ? "green" : "orange",
  } as const;
}

function actionTypeLabel(actionType: Scenario["action_type"]) {
  const labels: Record<Scenario["action_type"], string> = {
    removeChannel: "Remover",
    reducePresence: "Reduzir presença",
    redistributeBudget: "Redistribuir budget",
    compareModels: "Comparar modelos",
    path: "Simular caminho",
  };
  return labels[actionType] ?? actionType;
}

function formatSignedPercentPoints(value: number) {
  const pp = value * 100;
  const sign = pp >= 0 ? "+" : "";
  return `${sign}${pp.toFixed(2).replace(".", ",")} p.p.`;
}

function formatSignedCurrency(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatCompactBRL(Math.abs(value))}`;
}
