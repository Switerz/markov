import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { TopBar } from "../../app/TopBar";
import { Button, useToast } from "../../shared/ui";
import { Plus, Save, EllipsisVertical, Calendar } from "lucide-react";
import { NewRunDialog } from "../../app/dialogs/NewRunDialog";
import { ScenarioBuilderForm } from "./components/ScenarioBuilderForm";
import { BaselineScenarioComparison } from "./components/BaselineScenarioComparison";
import { AttributionRedistributionWaterfall } from "./components/AttributionRedistributionWaterfall";
import { ScenarioInsightsPanel } from "./components/ScenarioInsightsPanel";
import { ScenarioComparisonTable } from "./components/ScenarioComparisonTable";
import { useExperimentsData } from "./hooks/useExperimentsData";
import styles from "./ExperimentsPage.module.css";

export function ExperimentsPage() {
  const data = useExperimentsData();
  const toast = useToast();
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [scenarioFlash, setScenarioFlash] = useState(false);

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
                    disabled
                  >
                    Em breve
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
              onApply={() => {
                // TODO(api): wire to api.createScenario + api.analyzeScenario.
                toast.push("Cenário aplicado", "green");
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
              <BaselineScenarioComparison data={data.baselineVsScenario} />
            </div>
            <AttributionRedistributionWaterfall
              redistribution={data.redistributionChart}
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
