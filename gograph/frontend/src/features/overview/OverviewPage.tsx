import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { TopBar } from "../../app/TopBar";
import { Button, useToast } from "../../shared/ui";
import { downloadCsv, todayIso } from "../../shared/format";
import { NewRunDialog } from "../../app/dialogs/NewRunDialog";
import { OverviewHeaderFilters } from "./components/OverviewHeaderFilters";
import { MetricCardGrid } from "./components/MetricCardGrid";
import { PriorityDecisionCarousel } from "./components/PriorityDecisionCarousel";
import { ModelConsensusMatrix } from "./components/ModelConsensusMatrix";
import { JourneySummaryPanel } from "./components/JourneySummaryPanel";
import { AnalysisConfidencePanel } from "./components/AnalysisConfidencePanel";
import { useOverviewData } from "./hooks/useOverviewData";
import { useOverviewFilters } from "./hooks/useOverviewFilters";
import styles from "./OverviewPage.module.css";

export function OverviewPage() {
  // TODO(api): when filters become functional, swap useOverviewData for an
  // api-backed hook keyed on { account, period, compareWith, executionId }.
  const data = useOverviewData();
  const { filters, set } = useOverviewFilters();
  const toast = useToast();
  const [newRunOpen, setNewRunOpen] = useState(false);
  return (
    <>
      <TopBar
        title={data.screen.title}
        filters={
          <OverviewHeaderFilters
            filters={data.topBar.filters}
            values={filters}
            onChange={set}
          />
        }
        actions={
          <>
            <Button
              variant="primary"
              iconLeft={<Plus size={16} />}
              onClick={() => setNewRunOpen(true)}
            >
              Nova execução
            </Button>
            <Button
              variant="secondary"
              iconLeft={<Download size={16} />}
              onClick={() => {
                // Export the priority decisions table (most actionable summary
                // for the overview screen).
                const rows = data.priorityDecisions.cards.map((c) => ({
                  channel: c.channel,
                  recommendation: c.recommendation,
                  share_spend: c.shareSpend,
                  share_revenue: c.shareRevenue,
                  roas: c.roas,
                  description: c.description,
                }));
                downloadCsv(`overview-canais-${todayIso()}.csv`, rows);
                toast.push("Exportação iniciada", "green");
              }}
            >
              Exportar
            </Button>
          </>
        }
      />
      <NewRunDialog open={newRunOpen} onOpenChange={setNewRunOpen} />
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
