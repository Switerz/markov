import { ChevronDown } from "lucide-react";
import { Badge, Card, StatDelta } from "../../../shared/ui";
import { toneColor } from "../../../shared/charts";
import { channelIcon, channelInitial } from "../../../shared/icons/channelIcons";
import type { Tone } from "../../../shared/tokens/tokens";
import type { CompareExecutions } from "../types";

import styles from "./ExecutionComparisonPanel.module.css";

export type ExecutionComparisonPanelProps = {
  compare: CompareExecutions;
};

// Inline percent parser — matches the shape used in other phases. Returns
// 0..1; falls back to 0 when no percentage is present.
function parsePercent(raw: string): number {
  const m = raw.trim().match(/^(-?[\d.,]+)\s*%$/);
  if (!m) return 0;
  const n = Number(m[1].replace(",", "."));
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n / 100));
}

function ChannelIconBox({ name }: { name: string }) {
  const icon = channelIcon(name, 14);
  return (
    <span className={styles.channelIconWrap} aria-hidden>
      {icon ?? channelInitial(name)}
    </span>
  );
}

const legendDotTone: Record<string, Tone> = {
  green: "green",
  red: "red",
  neutral: "neutral",
  gray: "neutral",
};

function badgeTone(t: string): Tone {
  if (t === "positive") return "green";
  if (t === "negative") return "red";
  if (t === "warning") return "orange";
  return "neutral";
}

export function ExecutionComparisonPanel({ compare }: ExecutionComparisonPanelProps) {
  // Pick a max for the bars so the from/to mini-bars use a comparable scale
  // across rows in the same panel.
  const maxPct = compare.channelContributionChange.reduce((acc, r) => {
    return Math.max(acc, parsePercent(r.from), parsePercent(r.to));
  }, 0.01);

  return (
    <Card>
      <Card.Header>
        <div className={styles.headerRow}>
          <Card.Title>{compare.title}</Card.Title>
          <div className={styles.headerControls}>
            <button type="button" className={styles.chip} aria-label="Selecionar execução base">
              {compare.from}
              <ChevronDown size={12} aria-hidden />
            </button>
            <button type="button" className={styles.chip} aria-label="Selecionar execução de referência">
              {compare.to}
              <ChevronDown size={12} aria-hidden />
            </button>
          </div>
        </div>
      </Card.Header>
      <Card.Body>
        <div className={styles.body}>
          <div className={styles.variation}>
            <span className={styles.variationLabel}>{compare.variation.title}</span>
            <div className={styles.variationRow}>
              <span className={styles.variationValue}>{compare.variation.value}</span>
              <StatDelta value={compare.variation.delta} tone="positive" />
            </div>
          </div>

          <div className={styles.list}>
            {compare.channelContributionChange.map((r) => {
              const fromPct = parsePercent(r.from);
              const toPct = parsePercent(r.to);
              const fromWidth = (fromPct / maxPct) * 100;
              const toWidth = (toPct / maxPct) * 100;
              return (
                <div key={r.channel} className={styles.row}>
                  <div className={styles.channel}>
                    <ChannelIconBox name={r.channel} />
                    <span>{r.channel}</span>
                  </div>
                  <div className={styles.bars}>
                    <div className={styles.barRow}>
                      <span className={styles.barLabel}>De</span>
                      <div className={styles.barTrack}>
                        <div
                          className={`${styles.barFill} ${styles.barFillFrom}`}
                          style={{ width: `${fromWidth}%` }}
                        />
                      </div>
                      <span className={styles.barValue}>{r.from}</span>
                    </div>
                    <div className={styles.barRow}>
                      <span className={styles.barLabel}>Para</span>
                      <div className={styles.barTrack}>
                        <div
                          className={`${styles.barFill} ${styles.barFillTo}`}
                          style={{ width: `${toWidth}%` }}
                        />
                      </div>
                      <span className={styles.barValue}>{r.to}</span>
                    </div>
                  </div>
                  <Badge tone={badgeTone(r.tone)} variant="soft" size="sm">
                    {r.delta}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      </Card.Body>
      <Card.Footer>
        <div className={styles.footerRow}>
          <div className={styles.legend}>
            {compare.legend.map((l) => {
              const dotTone = legendDotTone[l.tone] ?? "neutral";
              return (
                <span key={l.label} className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{ background: toneColor(dotTone) }}
                    aria-hidden
                  />
                  {l.label}
                </span>
              );
            })}
          </div>
          <a href="#full-compare" className={styles.action}>
            {compare.action}
          </a>
        </div>
      </Card.Footer>
    </Card>
  );
}
