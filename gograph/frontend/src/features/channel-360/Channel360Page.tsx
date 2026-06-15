import { ChannelHeader } from "./components/ChannelHeader";
import { ChannelMetricStrip } from "./components/ChannelMetricStrip";
import { AttributionEfficiencyTable } from "./components/AttributionEfficiencyTable";
import { JourneyRoleDonut } from "./components/JourneyRoleDonut";
import { RecommendationEvidencePanel } from "./components/RecommendationEvidencePanel";
import { ChannelQuickDetails } from "./components/ChannelQuickDetails";
import { AdjacentChannelsTables } from "./components/AdjacentChannelsTables";
import { RelevantSequencesList } from "./components/RelevantSequencesList";
import { ChannelTrendChart } from "./components/ChannelTrendChart";
import { useChannel360Data } from "./hooks/useChannel360Data";
import styles from "./Channel360Page.module.css";

export function Channel360Page() {
  const data = useChannel360Data();
  return (
    <>
      <ChannelHeader
        meta={data.screen}
        filters={data.topBar.filters}
        actions={data.topBar.actions}
      />
      <div className={styles.page}>
        <div className={styles.grid}>
          <section className={styles.left}>
            <ChannelMetricStrip metrics={data.metricStrip} />
            <div className={styles.row2}>
              <AttributionEfficiencyTable efficiency={data.attributionEfficiency} />
              <JourneyRoleDonut role={data.journeyRole} />
            </div>
            <AdjacentChannelsTables tables={data.tables} />
            <RelevantSequencesList sequences={data.relevantSequences} />
            <ChannelTrendChart evolution={data.timeEvolution} />
          </section>
          <aside className={styles.right}>
            <RecommendationEvidencePanel evidence={data.recommendationEvidence} />
            <ChannelQuickDetails details={data.quickDetails} />
          </aside>
        </div>
      </div>
    </>
  );
}
