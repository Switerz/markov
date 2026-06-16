import { useCallback, useMemo, useState } from "react";
import { Plus, Download } from "lucide-react";
import { TopBar } from "../../app/TopBar";
import { Button, Tabs, useToast } from "../../shared/ui";
import { downloadCsv, todayIso } from "../../shared/format";
import { NewRunDialog } from "../../app/dialogs/NewRunDialog";
import { useActiveRun } from "../../app/hooks/useActiveRun";
import { JourneyFilters } from "./components/JourneyFilters";
import { JourneyViewTabs } from "./components/JourneyViewTabs";
import { JourneySankeyPanel } from "./components/JourneySankeyPanel";
import { JourneyGraphPanel } from "./components/JourneyGraphPanel";
import { TopPathsTable } from "./components/TopPathsTable";
import { TransitionMatrixHeatmap } from "./components/TransitionMatrixHeatmap";
import { JourneyPathBuilder } from "./components/JourneyPathBuilder";
import { LoopsPatternsList } from "./components/LoopsPatternsList";
import {
  DEFAULT_JOURNEY_FILTERS,
  useJourneysData,
  type JourneyFiltersState,
} from "./hooks/useJourneysData";
import { useJourneyGraphMock } from "./hooks/useJourneyGraphMock";
import styles from "./JourneysPage.module.css";

// Layout decision (per spec criterion):
// The bottom row of Top paths + Matrix + Loops is always visible. The tab
// switcher controls the *upper* primary view (Flow vs Graph vs Paths vs
// Matrix). Paths/Matrix tabs intentionally duplicate the bottom-row data
// because the spec lists those as the v1 dedicated tabs AND the bottom
// 3-card row criterion (acceptance: "três cards na parte inferior").
export function JourneysPage() {
  const [journeyFilters, setJourneyFilters] = useState<JourneyFiltersState>(
    DEFAULT_JOURNEY_FILTERS,
  );
  const data = useJourneysData(journeyFilters);
  const graph = useJourneyGraphMock(data);
  const [tab, setTab] = useState<string>("flow");
  const [newRunOpen, setNewRunOpen] = useState(false);
  const toast = useToast();
  const activeRun = useActiveRun();
  const runId = activeRun?.id;

  // Pool of channel labels for origin/destination — derived from sankey nodes
  // so the dropdowns reflect the channels actually present in the data.
  const channelOptions = useMemo<string[]>(() => {
    const pool = new Set<string>();
    data.journeyFlow.leftNodes.forEach((n) => pool.add(n.channel));
    data.journeyFlow.middleNodes.forEach((n) => pool.add(n.channel));
    return Array.from(pool).sort();
  }, [data.journeyFlow]);

  const setFilter = useCallback(
    <K extends keyof JourneyFiltersState>(
      key: K,
      value: JourneyFiltersState[K],
    ) => {
      setJourneyFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

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
              iconLeft={<Download size={16} />}
              onClick={() => {
                const rows = data.topPaths.rows.map((r) => ({
                  rank: r.rank,
                  path: r.path,
                  participation: r.participation,
                  delta: r.delta,
                  revenue: r.revenue,
                  conversions: r.conversions,
                  ticket: r.ticket,
                  time_to_conversion: r.timeToConversion,
                }));
                downloadCsv(`top-caminhos-${todayIso()}.csv`, rows);
                toast.push("Exportação iniciada", "green");
              }}
            >
              Exportar
            </Button>
          </>
        }
        filters={
          <JourneyFilters
            filters={data.filters}
            state={journeyFilters}
            onChange={setFilter}
            channelOptions={channelOptions}
          />
        }
      />
      <NewRunDialog open={newRunOpen} onOpenChange={setNewRunOpen} />
      <div className={styles.page}>
        <Tabs.Root value={tab} onValueChange={setTab}>
          <JourneyViewTabs tabs={data.viewTabs} />
          <Tabs.Content value="flow">
            <div className={styles.flowGrid}>
              <JourneySankeyPanel
                flow={data.journeyFlow}
                metric={data.flowMetric}
                onSwitchToGraph={() => setTab("graph")}
              />
              <JourneyPathBuilder
                builder={data.journeyBuilder}
                runId={runId}
              />
            </div>
          </Tabs.Content>
          <Tabs.Content value="graph">
            <JourneyGraphPanel nodes={graph.nodes} edges={graph.edges} />
          </Tabs.Content>
          <Tabs.Content value="paths">
            <TopPathsTable paths={data.topPaths} />
          </Tabs.Content>
          <Tabs.Content value="matrix">
            <TransitionMatrixHeatmap matrix={data.transitionMatrix} />
          </Tabs.Content>
        </Tabs.Root>

        <div className={styles.bottomGrid}>
          <TopPathsTable paths={data.topPaths} />
          <TransitionMatrixHeatmap matrix={data.transitionMatrix} />
          <LoopsPatternsList loops={data.loopsAndPatterns} />
        </div>
      </div>
    </>
  );
}
