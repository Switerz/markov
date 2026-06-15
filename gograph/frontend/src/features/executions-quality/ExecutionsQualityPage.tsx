import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { TopBar } from "../../app/TopBar";
import { Button, useToast } from "../../shared/ui";
import { Plus, Settings, Download, EllipsisVertical } from "lucide-react";
import { NewRunDialog } from "../../app/dialogs/NewRunDialog";
import { downloadCsv, todayIso } from "../../shared/format";
import type { ModelRunCreatePayload } from "../../lib/api";
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
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [reexecOpen, setReexecOpen] = useState(false);
  const toast = useToast();
  return (
    <>
      <TopBar
        title={data.screen.title}
        subtitle={data.screen.subtitle}
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
              iconLeft={<Settings size={16} />}
              onClick={() =>
                toast.push("Parâmetros do modelo — em breve", "blue")
              }
            >
              Parâmetros do modelo
            </Button>
            <Button
              variant="secondary"
              iconLeft={<Download size={16} />}
              onClick={() => {
                const rows = data.executionHistory.rows.map((r) => ({
                  id: r.id,
                  period: r.period,
                  status: r.status,
                  revenue: r.revenue,
                  observed_conversion: r.observedConversion,
                  modeled_conversion: r.modeledConversion,
                  confidence: r.confidence,
                  runtime: r.runtime,
                  created_by: r.createdBy,
                  created_at: r.createdAt,
                }));
                downloadCsv(`execucoes-${todayIso()}.csv`, rows);
                toast.push("Exportação iniciada", "green");
              }}
            >
              Exportar
            </Button>
          </>
        }
      />
      <NewRunDialog open={newRunOpen} onOpenChange={setNewRunOpen} />
      <NewRunDialog open={reexecOpen} onOpenChange={setReexecOpen} />
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
            <ExecutionDetailsPanel
              panel={data.executionDetailsPanel}
              onReexecute={() => setReexecOpen(true)}
              onClose={() => setSelectedId(undefined)}
              onMoreActions={() =>
                toast.push("Mais ações — em breve", "blue")
              }
            />
          </aside>
        </div>
      </div>
    </>
  );
}
