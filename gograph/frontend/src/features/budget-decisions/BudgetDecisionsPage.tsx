import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { TopBar } from "../../app/TopBar";
import { Button } from "../../shared/ui";
import { useBudgetDecisionsData } from "./hooks/useBudgetDecisionsData";
import { BudgetDecisionFilters } from "./components/BudgetDecisionFilters";
import { RecommendationSummaryCards } from "./components/RecommendationSummaryCards";
import { AllocationMatrix } from "./components/AllocationMatrix";
import { OpportunitiesRisksPanel } from "./components/OpportunitiesRisksPanel";
import { ChannelDecisionTable } from "./components/ChannelDecisionTable";
import { ChannelDetailsDrawer } from "./components/ChannelDetailsDrawer";
import styles from "./BudgetDecisionsPage.module.css";

export function BudgetDecisionsPage() {
  const data = useBudgetDecisionsData();
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  // The contract opens the drawer pre-selected on Google Ads. We mirror that
  // on first mount so the screen matches the visual reference. Users still
  // close (Esc / X) and re-open by clicking any row or bubble.
  useEffect(() => {
    setSelectedChannel(data.selectedChannelDrawer.channel);
  }, [data.selectedChannelDrawer.channel]);

  const drawer = data.getDrawerForChannel(
    selectedChannel ?? data.selectedChannelDrawer.channel,
  );
  const drawerForView = selectedChannel
    ? { ...drawer, channel: selectedChannel }
    : drawer;

  return (
    <>
      <TopBar
        title={data.screen.title}
        filters={<BudgetDecisionFilters filters={data.topBar.filters} />}
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
        <RecommendationSummaryCards cards={data.summaryCards} />
        <div className={styles.twoCol}>
          <AllocationMatrix
            matrix={data.allocationMatrix}
            onPointClick={(ch) => setSelectedChannel(ch)}
          />
          <OpportunitiesRisksPanel data={data.opportunitiesAndRisks} />
        </div>
        <ChannelDecisionTable
          data={data.channelsTable}
          onSelect={(ch) => setSelectedChannel(ch)}
          selectedChannel={selectedChannel}
        />
        <ChannelDetailsDrawer
          open={selectedChannel !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedChannel(null);
          }}
          drawer={drawerForView}
        />
      </div>
    </>
  );
}
