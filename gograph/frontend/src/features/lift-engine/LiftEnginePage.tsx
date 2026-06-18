import { useCallback, useState } from "react";
import { Download, Zap, Loader2 } from "lucide-react";
import { TopBar } from "../../app/TopBar";
import { Button, Badge, Select, Tabs } from "../../shared/ui";
import { downloadCsv, todayIso } from "../../shared/format";
import {
  DEFAULT_LIFT_FILTERS,
  useLiftEngineData,
  type LiftFiltersState,
} from "./hooks/useLiftEngineData";
import { LiftMetricStrip } from "./components/LiftMetricStrip";
import { LiftInsightCard } from "./components/LiftInsightCard";
import type { LiftCategory } from "./types";
import styles from "./LiftEnginePage.module.css";

const CATEGORY_TABS: Array<{ value: LiftCategory | "todos"; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "canal", label: "Canal" },
  { value: "sequencia", label: "Sequência" },
  { value: "conteudo", label: "Conteúdo" },
  { value: "pagina", label: "Página" },
  { value: "evento", label: "Evento" },
];

const CONFIDENCE_OPTIONS = [
  { value: "todos", label: "Qualquer confiança" },
  { value: "alta", label: "Alta confiança" },
  { value: "media", label: "Média confiança" },
  { value: "baixa", label: "Baixa confiança" },
] as const;

const PRIORITY_ORDER: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };

function fmtDate(iso: string | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function LiftEnginePage() {
  const [filters, setFilters] = useState<LiftFiltersState>(DEFAULT_LIFT_FILTERS);
  const { data, runId, startDate, endDate, isLoading, isMock } = useLiftEngineData(filters);

  const setFilter = useCallback(
    <K extends keyof LiftFiltersState>(key: K, value: LiftFiltersState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const sorted = [...data.insights].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
  );

  const runLabel = runId != null
    ? `Execução #${runId} · ${fmtDate(startDate)} – ${fmtDate(endDate)}`
    : undefined;

  return (
    <>
      <TopBar
        title={
          <span className={styles.titleRow}>
            <Zap size={18} className={styles.titleIcon} />
            {data.screen.title}
          </span>
        }
        subtitle={runLabel ?? data.screen.subtitle}
        actions={
          <div className={styles.actionsRow}>
            {isLoading && (
              <span className={styles.loadingBadge}>
                <Loader2 size={13} className={styles.spin} />
                Carregando dados reais…
              </span>
            )}
            {!isLoading && isMock && (
              <Badge tone="orange" variant="soft" size="sm">Dados de exemplo</Badge>
            )}
            {!isLoading && !isMock && (
              <Badge tone="green" variant="soft" size="sm">Dados reais · Run #{runId}</Badge>
            )}
            <Button
              variant="secondary"
              iconLeft={<Download size={16} />}
              onClick={() => {
                const rows = data.insights.map((ins) => ({
                  categoria: ins.category,
                  titulo: ins.title,
                  lift_pct: ins.liftPct,
                  prioridade: ins.priority,
                  confianca: ins.confidence,
                  hipotese: ins.hypothesis,
                }));
                downloadCsv(`motor-de-lift-${todayIso()}.csv`, rows);
              }}
            >
              Exportar
            </Button>
          </div>
        }
        filters={
          <div className={styles.filterRow}>
            <Select
              value={filters.confidence}
              onValueChange={(v) => setFilter("confidence", v as LiftFiltersState["confidence"])}
              placeholder="Qualquer confiança"
              ariaLabel="Filtrar por confiança"
            >
              {CONFIDENCE_OPTIONS.map((opt) => (
                <Select.Item key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Item>
              ))}
            </Select>
          </div>
        }
      />

      <div className={styles.page}>
        <LiftMetricStrip metrics={data.metrics} />

        <Tabs.Root
          value={filters.category}
          onValueChange={(v) => setFilter("category", v as LiftFiltersState["category"])}
        >
          <div className={styles.tabsHeader}>
            <Tabs.List>
              {CATEGORY_TABS.map((tab) => (
                <Tabs.Trigger key={tab.value} value={tab.value}>
                  {tab.label}
                  {tab.value === "todos" && (
                    <Badge tone="neutral" variant="soft" size="sm" className={styles.tabCount}>
                      {data.insights.length}
                    </Badge>
                  )}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </div>

          {CATEGORY_TABS.map((tab) => (
            <Tabs.Content key={tab.value} value={tab.value}>
              {sorted.length === 0 ? (
                <div className={styles.empty}>
                  Nenhum insight encontrado para os filtros selecionados.
                </div>
              ) : (
                <div className={styles.insightsGrid}>
                  {sorted.map((insight) => (
                    <LiftInsightCard key={insight.id} insight={insight} />
                  ))}
                </div>
              )}
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </div>
    </>
  );
}
