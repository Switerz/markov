import { useMemo } from "react";
import { Network } from "lucide-react";
import { Card, Button, Select } from "../../../shared/ui";
import {
  SankeyJourneyChart,
  type SankeyNode,
  type SankeyLink,
} from "../../../shared/charts";
import type { JourneyFlow, FlowMetric } from "../types";
import type { Tone } from "../../../shared/tokens/tokens";
import styles from "./JourneySankeyPanel.module.css";

export type JourneySankeyPanelProps = {
  flow: JourneyFlow;
  metric: FlowMetric;
  onSwitchToGraph?: () => void;
};

// Parses Brazilian-formatted percentages like "32,1%" → 0.321.
export function parsePercent(raw: string): number {
  const cleaned = raw.replace(/[^0-9,.-]/g, "").replace(",", ".");
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return 0;
  return num / 100;
}

export function JourneySankeyPanel({
  flow,
  metric,
  onSwitchToGraph,
}: JourneySankeyPanelProps) {
  const { nodes, links } = useMemo(() => {
    // Disambiguate channels that appear on multiple columns by suffixing
    // :in / :mid / :out so Nivo Sankey can build a DAG without duplicates.
    const leftNodes: SankeyNode[] = flow.leftNodes.map((n) => ({
      id: `${n.channel}:in`,
      tone: n.tone,
    }));
    const middleNodes: SankeyNode[] = flow.middleNodes.map((n) => ({
      id: `${n.channel}:mid`,
      tone: "neutral" as Tone,
    }));
    const outcomeNodes: SankeyNode[] = flow.outcomeNodes.map((n) => ({
      id: `${n.label}:out`,
      tone: n.tone,
    }));

    const links: SankeyLink[] = [];
    // Synthesize plausible flow: every leftNode → every middleNode with
    // value = leftPct * midPct. Same heuristic for middle → outcome.
    flow.leftNodes.forEach((l) => {
      const lp = parsePercent(l.value);
      flow.middleNodes.forEach((m) => {
        const mp = parsePercent(m.value);
        const v = +(lp * mp * 1000).toFixed(3);
        if (v > 0) {
          links.push({
            source: `${l.channel}:in`,
            target: `${m.channel}:mid`,
            value: v,
          });
        }
      });
    });
    flow.middleNodes.forEach((m) => {
      const mp = parsePercent(m.value);
      flow.outcomeNodes.forEach((o) => {
        const op = parsePercent(o.value);
        const v = +(mp * op * 1000).toFixed(3);
        if (v > 0) {
          links.push({
            source: `${m.channel}:mid`,
            target: `${o.label}:out`,
            value: v,
          });
        }
      });
    });

    return {
      nodes: [...leftNodes, ...middleNodes, ...outcomeNodes],
      links,
    };
  }, [flow]);

  return (
    <Card>
      <Card.Header>
        <div className={styles.headerWrap}>
          <div className={styles.headerText}>
            <Card.Title>{flow.title}</Card.Title>
            <Card.Description>{flow.subtitle}</Card.Description>
          </div>
          <div className={styles.headerRight}>
            <Select
              value={metric.value}
              ariaLabel={metric.label}
            >
              <Select.Item value={metric.value}>{metric.value}</Select.Item>
            </Select>
          </div>
        </div>
      </Card.Header>
      <Card.Body className={styles.chartWrapper}>
        <SankeyJourneyChart
          nodes={nodes}
          links={links}
          metricLabel={metric.value}
          height={420}
        />
        <div className={styles.footerRow}>
          <span>Cobertura: {flow.footer.coverage}</span>
          <span className={styles.footerLegend}>{flow.footer.legend}</span>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Network size={14} />}
            onClick={onSwitchToGraph}
          >
            {flow.footer.action}
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}
