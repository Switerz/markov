import { Download, Plus } from "lucide-react";
import { TopBar } from "../../app/TopBar";
import { Button } from "../../shared/ui";
import { OverviewHeaderFilters } from "./components/OverviewHeaderFilters";
import { MetricCardGrid } from "./components/MetricCardGrid";
import { PriorityDecisionCarousel } from "./components/PriorityDecisionCarousel";
import { ModelConsensusMatrix } from "./components/ModelConsensusMatrix";
import { JourneySummaryPanel } from "./components/JourneySummaryPanel";
import { AnalysisConfidencePanel } from "./components/AnalysisConfidencePanel";
import { useOverviewData } from "./hooks/useOverviewData";
import styles from "./OverviewPage.module.css";

export function OverviewPage() {
  const data = useOverviewData();
  return (
    <>
      <TopBar
        title={data.screen.title}
        filters={<OverviewHeaderFilters filters={data.topBar.filters} />}
        actions={
          <>
            <Button variant="primary" iconLeft={<Plus size={16} />}>
              Nova execução
            </Button>
            <Button variant="secondary" iconLeft={<Download size={16} />}>
              Exportar
            </Button>
          </>
        }
      />
      <div className={styles.page}>
        <MetricCardGrid metrics={data.metrics} />
        <PriorityDecisionCarousel decisions={data.priorityDecisions} />
        <div className={styles.twoCol}>
          <ModelConsensusMatrix consensus={data.modelConsensus} />
          <JourneySummaryPanel journey={data.journeySummary} />
        </div>
        <AnalysisConfidencePanel confidence={data.analysisConfidence} />
        <p className={styles.footerNote}>{data.footerNote}</p>
      </div>
    </>
  );
}
