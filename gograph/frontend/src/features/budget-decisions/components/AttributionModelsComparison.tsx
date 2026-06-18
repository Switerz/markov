import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ChannelRow, type TouchpointRow } from "../../../lib/api";
import { channelTone, formatPercent } from "../../../shared/format";
import { toneColor } from "../../../shared/charts";
import { Card } from "../../../shared/ui";
import styles from "./AttributionModelsComparison.module.css";

export type AttributionModelsComparisonProps = {
  runId?: number;
};

type ModelKey = "last_click" | "first_utm" | "linear" | "markov" | "shapley";

type ModelColumn = {
  id: ModelKey;
  label: string;
  description: string;
};

const COLUMNS: ModelColumn[] = [
  { id: "last_click", label: "LAST-CLICK", description: "baseline" },
  { id: "first_utm", label: "FIRST-UTM", description: "H5" },
  { id: "linear", label: "LINEAR", description: "igualitário" },
  { id: "markov", label: "MARKOV", description: "removal effect" },
  { id: "shapley", label: "SHAPLEY", description: "amostra 50k" },
];

type ChannelRowData = {
  channel: string;
  last_click: number;
  first_utm: number;
  linear: number;
  markov: number;
  shapley: number;
  bias: number | null; // first_utm / last_click
};

export function AttributionModelsComparison({ runId }: AttributionModelsComparisonProps) {
  const channelsQuery = useQuery({
    queryKey: ["channels", runId],
    enabled: runId != null,
    queryFn: () => api.getChannels(runId!),
  });
  const touchpointsQuery = useQuery({
    queryKey: ["touchpoints", runId],
    enabled: runId != null,
    queryFn: () => api.getTouchpoints(runId!),
  });

  const rows = useMemo<ChannelRowData[]>(() => {
    const channels = channelsQuery.data?.rows ?? [];
    const touchpoints = touchpointsQuery.data?.rows ?? [];
    if (channels.length === 0) return [];
    return buildRows(channels, touchpoints);
  }, [channelsQuery.data, touchpointsQuery.data]);

  const narrative = useMemo(() => buildNarrative(rows), [rows]);

  return (
    <Card>
      <Card.Header className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>Comparativo dos 5 modelos de atribuição</span>
          <Card.Title>Como cada modelo distribui a receita</Card.Title>
          <Card.Description>
            % da receita atribuída a cada canal. Intensidade = peso. A última coluna mostra o viés First-UTM ÷ Last-click.
          </Card.Description>
        </div>
      </Card.Header>
      <Card.Body className={styles.body}>
        {rows.length === 0 ? (
          <div className={styles.empty}>
            Selecione uma execução completa para comparar os modelos de atribuição.
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colChannel}>CANAL</th>
                  {COLUMNS.map((c) => (
                    <th key={c.id} className={styles.colModel}>
                      <div className={styles.modelLabel}>{c.label}</div>
                      <div className={styles.modelDescription}>{c.description}</div>
                    </th>
                  ))}
                  <th className={styles.colBias}>
                    <div className={styles.modelLabel}>VIÉS</div>
                    <div className={styles.modelDescription}>First ÷ Last</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ChannelRow key={row.channel} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {narrative && <p className={styles.narrative}>{narrative}</p>}
      </Card.Body>
    </Card>
  );
}

function ChannelRow({ row }: { row: ChannelRowData }) {
  const dotColor = toneColor(channelTone(row.channel));
  return (
    <tr>
      <td className={styles.channelCell}>
        <span className={styles.dot} style={{ background: dotColor }} aria-hidden />
        <span className={styles.channelName}>{row.channel}</span>
      </td>
      {COLUMNS.map((col) => {
        const value = row[col.id];
        return (
          <td key={col.id} className={styles.cell}>
            <ModelCell value={value} />
          </td>
        );
      })}
      <td className={styles.cell}>
        <BiasCell value={row.bias} />
      </td>
    </tr>
  );
}

function ModelCell({ value }: { value: number }) {
  // value is 0..1. Map to opacity 0..1 to create the intensity ramp.
  const opacity = Math.max(0.08, Math.min(0.85, value * 1.6));
  return (
    <div
      className={styles.modelCell}
      style={{ background: `rgba(91, 79, 229, ${opacity})` }}
    >
      <span className={value >= 0.18 ? styles.modelCellTextStrong : styles.modelCellText}>
        {formatPercent(value, 0)}
      </span>
    </div>
  );
}

function BiasCell({ value }: { value: number | null }) {
  if (value == null) {
    return <div className={`${styles.biasCell} ${styles.biasNeutral}`}>—</div>;
  }
  const display = `${value.toFixed(2).replace(".", ",")}x`;
  const cls = value > 1.1 ? styles.biasPositive : value < 0.9 ? styles.biasNegative : styles.biasNeutral;
  return <div className={`${styles.biasCell} ${cls}`}>{display}</div>;
}

function buildRows(channels: ChannelRow[], touchpoints: TouchpointRow[]): ChannelRowData[] {
  // Filter out "Other" / start / outcome states and channels with negligible activity.
  const cleaned = channels.filter(
    (c) =>
      c.channel !== "Other" &&
      c.channel !== "(start)" &&
      c.channel !== "Conversion" &&
      c.channel !== "Non-Conversion" &&
      ((c.markov_revenue ?? 0) + (c.shapley_revenue ?? 0) + (c.spend ?? 0) > 0),
  );

  const totals = {
    last_click: sum(cleaned, (c) => c.last_click_revenue),
    first_utm: sum(cleaned, (c) => c.first_click_revenue),
    markov: sum(cleaned, (c) => c.markov_revenue),
    shapley: sum(cleaned, (c) => c.shapley_revenue),
  };

  // Linear share = channel touches / total touches in converting journeys.
  const touchTotals = new Map<string, number>();
  let touchSum = 0;
  for (const t of touchpoints) {
    const total =
      (t.starter_count ?? 0) + (t.assist_count ?? 0) + (t.closer_count ?? 0);
    touchTotals.set(t.channel, total);
    touchSum += total;
  }

  const rows: ChannelRowData[] = cleaned.map((c) => {
    const lc = safeShare(c.last_click_revenue ?? 0, totals.last_click);
    const fu = safeShare(c.first_click_revenue ?? 0, totals.first_utm);
    const ln = safeShare(touchTotals.get(c.channel) ?? 0, touchSum);
    const mk = safeShare(c.markov_revenue ?? 0, totals.markov);
    const sh = safeShare(c.shapley_revenue ?? 0, totals.shapley);
    const bias = lc > 0 ? fu / lc : null;
    return {
      channel: c.channel,
      last_click: lc,
      first_utm: fu,
      linear: ln,
      markov: mk,
      shapley: sh,
      bias,
    };
  });

  // Sort by Markov weight desc, then by max share desc.
  rows.sort((a, b) => b.markov - a.markov);
  // Cap to top 10 channels to keep the table readable.
  return rows.slice(0, 10);
}

function sum<T>(items: T[], pick: (it: T) => number | null | undefined): number {
  return items.reduce((acc, it) => acc + (pick(it) ?? 0), 0);
}

function safeShare(value: number, total: number): number {
  if (total <= 0) return 0;
  return value / total;
}

function buildNarrative(rows: ChannelRowData[]): string | null {
  if (rows.length === 0) return null;
  const highestBias = rows
    .filter((r) => r.bias != null && r.last_click >= 0.02)
    .reduce<ChannelRowData | null>(
      (acc, r) => (acc == null || (r.bias ?? 0) > (acc.bias ?? 0) ? r : acc),
      null,
    );
  const lowestBias = rows
    .filter((r) => r.bias != null && r.last_click >= 0.02)
    .reduce<ChannelRowData | null>(
      (acc, r) => (acc == null || (r.bias ?? 0) < (acc.bias ?? 0) ? r : acc),
      null,
    );
  if (!highestBias || !lowestBias) return null;
  const hi = `${(highestBias.bias ?? 0).toFixed(2).replace(".", ",")}x`;
  const lo = `${(lowestBias.bias ?? 0).toFixed(2).replace(".", ",")}x`;
  return `${highestBias.channel} recebe ${hi} mais crédito sob First-UTM que sob Last-click — coerente com papel de gerador de demanda. ${lowestBias.channel} é o oposto (${lo}): o Last-click o superdimensiona por ser quase sempre o último toque. Markov e Shapley ficam entre os dois extremos.`;
}
