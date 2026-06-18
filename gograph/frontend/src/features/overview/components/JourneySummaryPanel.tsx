import { Card } from "../../../shared/ui";
import { channelIcon, channelInitial } from "../../../shared/icons/channelIcons";
import { toneColor, toneSoftColor } from "../../../shared/charts";
import type { JourneyColumn, JourneyColumnItem, JourneySummary } from "../types";
import styles from "./JourneySummaryPanel.module.css";

export type JourneySummaryPanelProps = { journey: JourneySummary };

const COLUMN_ICONS: Record<string, string> = {
  "Top canais de entrada": "DoorOpen",
  "Top canais de meio": "Workflow",
  "Top canais de assistência": "Handshake",
  "Top canais de fim": "Flag",
};

const COLUMN_DESCRIPTIONS: Record<string, string> = {
  "Top canais de entrada": "Onde a jornada começou",
  "Top canais de meio": "Toques intermediários no caminho",
  "Top canais de assistência": "Apoiaram a jornada sem fechar",
  "Top canais de fim": "Onde a conversão aconteceu",
};

export function JourneySummaryPanel({ journey }: JourneySummaryPanelProps) {
  // Normalize bar widths within each column so the largest item fills 100%.
  return (
    <Card>
      <Card.Header>
        <Card.Title>{journey.title}</Card.Title>
        <Card.Description>
          Top 5 canais por posição na jornada — entrada, meio, assistência e fechamento.
        </Card.Description>
      </Card.Header>
      <Card.Body>
        <div className={styles.columns}>
          {journey.columns.map((column) => (
            <JourneyColumnCard key={column.title} column={column} />
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}

function JourneyColumnCard({ column }: { column: JourneyColumn }) {
  const max = column.items.reduce((acc, it) => Math.max(acc, it.valueRaw ?? 0), 0);
  const description = COLUMN_DESCRIPTIONS[column.title];
  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <h3 className={styles.columnTitle}>{column.title}</h3>
        {description && <p className={styles.columnDescription}>{description}</p>}
      </div>
      <ul className={styles.list}>
        {column.items.length === 0 ? (
          <li className={styles.empty}>Sem dados nesta janela.</li>
        ) : (
          column.items.map((item) => (
            <JourneyBarRow key={item.name} item={item} max={max} />
          ))
        )}
      </ul>
    </div>
  );
}

function JourneyBarRow({
  item,
  max,
}: {
  item: JourneyColumnItem;
  max: number;
}) {
  const ratio = max > 0 && item.valueRaw != null ? item.valueRaw / max : 0;
  const width = Math.max(2, Math.round(ratio * 100));
  const tone = item.tone ?? "neutral";
  const iconNode = channelIcon(item.name, 14);
  return (
    <li className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.channel}>
          <span className={styles.channelIcon} aria-hidden>
            {iconNode ?? channelInitial(item.name)}
          </span>
          <span className={styles.channelName}>{item.name}</span>
        </span>
        <span className={styles.value}>{item.value}</span>
      </div>
      <div className={styles.barTrack} style={{ background: toneSoftColor(tone) }}>
        <div
          className={styles.barFill}
          style={{ width: `${width}%`, background: toneColor(tone) }}
        />
      </div>
    </li>
  );
}

// Avoid unused import warning when we don't use the title list helper.
void JourneyColumnCard;
