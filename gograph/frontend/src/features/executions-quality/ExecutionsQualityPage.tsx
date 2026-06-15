import { useState } from "react";
import { TopBar } from "../../app/TopBar";
import { Button } from "../../shared/ui";
import { Plus, Settings, Download } from "lucide-react";
import { ExecutionSummaryCards } from "./components/ExecutionSummaryCards";
import { ExecutionHistoryTable } from "./components/ExecutionHistoryTable";
import { TrustCenterPanel } from "./components/TrustCenterPanel";
import { ExecutionComparisonPanel } from "./components/ExecutionComparisonPanel";
import { ExecutionDetailsPanel } from "./components/ExecutionDetailsPanel";
import { useExecutionsQualityData } from "./hooks/useExecutionsQualityData";
import styles from "./ExecutionsQualityPage.module.css";

export function ExecutionsQualityPage() {
  const data = useExecutionsQualityData();
  const defaultSelected =
    data.executionHistory.rows.find((r) => r.selected)?.id ??
    data.executionHistory.rows[0]?.id;
  // TODO(api): when api.getOverview(selectedId) is wired, swap the panel data
  // by selected id. Today the right panel always shows the mocked execution.
  const [selectedId, setSelectedId] = useState<string | undefined>(defaultSelected);
  return (
    <>
      <TopBar
        title={data.screen.title}
        subtitle={data.screen.subtitle}
        actions={
          <>
            <Button variant="primary" iconLeft={<Plus size={16} />}>
              Nova execução
            </Button>
            <Button variant="secondary" iconLeft={<Settings size={16} />}>
              Parâmetros do modelo
            </Button>
            <Button variant="secondary" iconLeft={<Download size={16} />}>
              Exportar
            </Button>
          </>
        }
      />
      <div className={styles.page}>
        <ExecutionSummaryCards metrics={data.summaryMetrics} />
        <div className={styles.grid}>
          <section className={styles.left}>
            <ExecutionHistoryTable
              history={data.executionHistory}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <div className={styles.row2}>
              <TrustCenterPanel trust={data.trustCenter} />
              <ExecutionComparisonPanel compare={data.compareExecutions} />
            </div>
          </section>
          <aside className={styles.right}>
            <ExecutionDetailsPanel panel={data.executionDetailsPanel} />
          </aside>
        </div>
      </div>
    </>
  );
}
