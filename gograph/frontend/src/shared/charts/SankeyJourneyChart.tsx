import { useMemo, type ReactNode } from "react";
import { ResponsiveSankey } from "@nivo/sankey";
import type { Tone } from "../tokens/tokens";
import { toneColor } from "./toneColor";
import styles from "./SankeyJourneyChart.module.css";

export type SankeyNode = { id: string; tone?: Tone; icon?: ReactNode };
export type SankeyLink = { source: string; target: string; value: number };

export type SankeyJourneyChartProps = {
  nodes: SankeyNode[];
  links: SankeyLink[];
  metricLabel: string;
  height?: number;
};

type RawNode = { id: string; tone?: Tone };
type RawLink = { source: string; target: string; value: number };

const NEUTRAL = "var(--gg-neutral)";

export function SankeyJourneyChart({
  nodes,
  links,
  metricLabel,
  height = 420,
}: SankeyJourneyChartProps) {
  const data = useMemo(() => {
    const rawNodes: RawNode[] = nodes.map((n) => ({ id: n.id, tone: n.tone }));
    const rawLinks: RawLink[] = links.map((l) => ({
      source: l.source,
      target: l.target,
      value: l.value,
    }));
    return { nodes: rawNodes, links: rawLinks };
  }, [nodes, links]);

  return (
    <div
      className={styles.root}
      style={{ height }}
      data-testid="sankey-root"
      aria-label={metricLabel}
    >
      <span className={styles.metricLabel}>{metricLabel}</span>
      <ResponsiveSankey<RawNode, RawLink>
        data={data}
        align="center"
        colors={(node) => (node.tone ? toneColor(node.tone) : NEUTRAL)}
        nodeOpacity={1}
        nodeThickness={18}
        nodeSpacing={24}
        nodeBorderWidth={0}
        nodeBorderColor={{ from: "color", modifiers: [["darker", 0.2]] }}
        linkOpacity={0.45}
        linkHoverOpacity={0.75}
        linkContract={2}
        enableLinkGradient
        labelPosition="outside"
        labelOrientation="horizontal"
        labelPadding={12}
        labelTextColor={{ from: "color", modifiers: [["darker", 1.4]] }}
        theme={{
          text: {
            fontFamily:
              "Inter, system-ui, sans-serif",
            fontSize: 12,
            fill: "var(--gg-text-primary)",
          },
          labels: {
            text: { fill: "var(--gg-text-primary)", fontSize: 12 },
          },
          axis: {
            ticks: {
              text: { fontSize: 11, fill: "var(--gg-text-secondary)" },
            },
          },
          tooltip: {
            container: {
              background: "var(--gg-surface)",
              color: "var(--gg-text-primary)",
              fontSize: 12,
              border: "1px solid var(--gg-border)",
              borderRadius: 8,
            },
          },
        }}
        animate={false}
      />
    </div>
  );
}
