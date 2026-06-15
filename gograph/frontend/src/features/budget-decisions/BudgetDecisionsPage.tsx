import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { TopBar } from "../../app/TopBar";
import { Button, useToast } from "../../shared/ui";
import { NewRunDialog } from "../../app/dialogs/NewRunDialog";
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
  // Drawer stays closed on initial load — users open it explicitly by
  // clicking a row in the table or a bubble in the matrix. The previous
  // auto-open behavior felt like an uncloseable sidebar.
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [newRunOpen, setNewRunOpen] = useState(false);
  const toast = useToast();

  // When the drawer is closed we still need to feed it a valid `drawer`
  // payload (Radix renders the component tree even while hidden). Fall back
  // to the contract's default channel so the component never sees `null`.
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
              onClick={() => toast.push("Exportação em preparação", "blue")}
            >
              Exportar
            </Button>
          </>
        }
      />
      <NewRunDialog open={newRunOpen} onOpenChange={setNewRunOpen} />
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
