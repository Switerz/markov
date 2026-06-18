import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "../../app/TopBar";
import { useActiveRun } from "../../app/hooks/useActiveRun";
import { Button, useToast } from "../../shared/ui";
import { downloadCsv, slugify, todayIso } from "../../shared/format";
import { NewRunDialog } from "../../app/dialogs/NewRunDialog";
import { OverviewHeaderFilters } from "./components/OverviewHeaderFilters";
import { MetricCardGrid } from "./components/MetricCardGrid";
import { PriorityDecisionCarousel } from "./components/PriorityDecisionCarousel";
import { ModelConsensusMatrix } from "./components/ModelConsensusMatrix";
import { JourneySummaryPanel } from "./components/JourneySummaryPanel";
import { useOverviewData } from "./hooks/useOverviewData";
import { useOverviewFilters } from "./hooks/useOverviewFilters";
import type { ConsensusModelId } from "./types";
import styles from "./OverviewPage.module.css";

export function OverviewPage() {
  const activeRun = useActiveRun();
  const [consensusX, setConsensusX] = useState<ConsensusModelId>("markov");
  const [consensusY, setConsensusY] = useState<ConsensusModelId>("shapley");
  const data = useOverviewData(activeRun?.id, undefined, { consensusX, consensusY });
  const { filters, set } = useOverviewFilters();
  const toast = useToast();
  const navigate = useNavigate();
  const [newRunOpen, setNewRunOpen] = useState(false);

  function handleViewChannel(channel: string) {
    navigate(`/performance/canais/${slugify(channel)}`);
  }
  function handleCreateScenario(channel: string) {
    navigate(`/experimentos?channel=${encodeURIComponent(channel)}`);
  }
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
        <PriorityDecisionCarousel
          decisions={data.priorityDecisions}
          onViewChannel={handleViewChannel}
          onCreateScenario={handleCreateScenario}
        />
        <ModelConsensusMatrix
          consensus={data.modelConsensus}
          onSelectX={setConsensusX}
          onSelectY={setConsensusY}
        />
        <JourneySummaryPanel journey={data.journeySummary} />
        <p className={styles.footerNote}>{data.footerNote}</p>
      </div>
    </>
  );
}
