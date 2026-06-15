import { TopBar } from "../../app/TopBar";
import { Button } from "../../shared/ui";
import { Plus, Save, EllipsisVertical, Calendar } from "lucide-react";
import { ScenarioBuilderForm } from "./components/ScenarioBuilderForm";
import { BaselineScenarioComparison } from "./components/BaselineScenarioComparison";
import { AttributionRedistributionWaterfall } from "./components/AttributionRedistributionWaterfall";
import { ScenarioInsightsPanel } from "./components/ScenarioInsightsPanel";
import { ScenarioComparisonTable } from "./components/ScenarioComparisonTable";
import { useExperimentsData } from "./hooks/useExperimentsData";
import styles from "./ExperimentsPage.module.css";

export function ExperimentsPage() {
  const data = useExperimentsData();
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
            <Button variant="primary" iconLeft={<Plus size={16} />}>
              Novo cenário
            </Button>
            <Button variant="secondary" iconLeft={<Save size={16} />}>
              Salvar experimento
            </Button>
            <Button variant="icon" aria-label="Mais opções">
              <EllipsisVertical size={16} />
            </Button>
          </>
        }
      />
      <div className={styles.page}>
        <div className={styles.grid}>
          <section className={styles.left}>
            <ScenarioBuilderForm
              builder={data.scenarioBuilder}
              onApply={() => {
                /* TODO(api): wire to api.analyzeScenario / api.compareScenarios. */
              }}
            />
            <BaselineScenarioComparison data={data.baselineVsScenario} />
            <AttributionRedistributionWaterfall
              redistribution={data.redistributionChart}
            />
            <ScenarioComparisonTable table={data.scenarioComparisonTable} />
          </section>
          <aside className={styles.right}>
            <ScenarioInsightsPanel insights={data.scenarioInsights} />
          </aside>
        </div>
      </div>
    </>
  );
}
