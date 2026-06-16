import { useEffect, useState } from "react";
import { TopBar } from "../../app/TopBar";
import { Button, useToast } from "../../shared/ui";
import { Plus, Settings, Download } from "lucide-react";
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
  const [selectedId, setSelectedId] = useState<string | undefined>(defaultSelected);
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [dialogDefaults, setDialogDefaults] =
    useState<Partial<ModelRunCreatePayload> | undefined>();
  const [dialogTitle, setDialogTitle] = useState("Nova execução");
  const [dialogSubmitLabel, setDialogSubmitLabel] = useState("Criar execução");
  const toast = useToast();
  const effectiveSelectedId = selectedId ?? defaultSelected;
  const selectedPanel = data.getDetailsForRun(effectiveSelectedId);

  useEffect(() => {
    if (!selectedId && defaultSelected) {
      setSelectedId(defaultSelected);
    }
  }, [defaultSelected, selectedId]);

  function openRunDialog(options?: {
    defaults?: Partial<ModelRunCreatePayload>;
    title?: string;
    submitLabel?: string;
  }) {
    setDialogDefaults(options?.defaults);
    setDialogTitle(options?.title ?? "Nova execução");
    setDialogSubmitLabel(options?.submitLabel ?? "Criar execução");
    setNewRunOpen(true);
  }

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
              onClick={() => openRunDialog()}
            >
              Nova execução
            </Button>
            <Button
              variant="secondary"
              iconLeft={<Settings size={16} />}
              onClick={() =>
                openRunDialog({
                  defaults: data.getDefaultsForRun(effectiveSelectedId),
                  title: "Nova execução com parâmetros atuais",
                  submitLabel: "Criar com estes parâmetros",
                })
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
              disabled={data.executionHistory.rows.length === 0}
            >
              Exportar
            </Button>
          </>
        }
      />
      <NewRunDialog
        open={newRunOpen}
        onOpenChange={setNewRunOpen}
        title={dialogTitle}
        submitLabel={dialogSubmitLabel}
        defaults={dialogDefaults}
      />
      <div className={styles.page}>
        {data.isLoading && (
          <div className={styles.apiState}>Carregando execuções da API...</div>
        )}
        {data.isError && (
          <div className={styles.apiState}>
            API indisponível; exibindo dados locais. {data.errorMessage}
          </div>
        )}
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
              panel={selectedPanel}
              onReexecute={() =>
                openRunDialog({
                  defaults: data.getDefaultsForRun(effectiveSelectedId),
                  title: "Reexecutar modelo",
                  submitLabel: "Reexecutar",
                })
              }
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
