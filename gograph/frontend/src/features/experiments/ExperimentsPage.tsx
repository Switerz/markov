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
import { useExperimentsData } from "./hooks/useExperimentsData";
import { downloadCsv, todayIso } from "../../shared/format";
import styles from "./ExperimentsPage.module.css";

export type AppliedScenario = {
  name: string;
  intensityPct: number;
};

export function ExperimentsPage() {
  const data = useExperimentsData();
  const toast = useToast();
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [scenarioFlash, setScenarioFlash] = useState(false);
  const [appliedScenario, setAppliedScenario] =
    useState<AppliedScenario | null>(null);

  function exportPanel() {
    const rows = data.scenarioComparisonTable.rows.map((r) => ({
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
                {data.topBar.executionContext.label}:{" "}
                <strong>{data.topBar.executionContext.value}</strong>
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
                  "Experimento salvo (persistência API em breve)",
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
              onApply={(values) => {
                // Local-only application: lift values into page state so the
                // comparison and waterfall components can react visually. The
                // API contract (api.createScenario + api.analyzeScenario)
                // remains a future hookup point.
                setAppliedScenario({
                  name: `${values.action} ${values.channel}`,
                  intensityPct: values.intensity,
                });
                toast.push(
                  `Cenário aplicado — ${values.action} ${values.channel} (${values.intensity}%)`,
                  "green",
                );
                setScenarioFlash(true);
                window.setTimeout(() => setScenarioFlash(false), 1500);
              }}
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
            <ScenarioComparisonTable table={data.scenarioComparisonTable} />
          </section>
          <aside className={styles.right}>
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
