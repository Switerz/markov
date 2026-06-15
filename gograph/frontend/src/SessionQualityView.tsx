import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { ChannelRow, SessionQualityRow } from "./api";

// ── Category helpers ────────────────────────────────────────────────────────

const CATEGORY_MAP: { label: string; color: string; channels: string[] }[] = [
  {
    label: "Mídia Paga",
    color: "#2563eb",
    channels: [
      "Paid Meta Ads", "TikTok Ads", "Google Ads / Search",
      "Google Ads / Search / Inst", "Google Ads / Shopping",
      "Google Ads / Shopping / Inst", "Google Ads / PMax",
      "Google Ads / Other", "Display / Retargeting",
    ],
  },
  {
    label: "CRM / Owned",
    color: "#7c3aed",
    channels: ["Email", "WhatsApp CRM", "SMS"],
  },
  {
    label: "Orgânico",
    color: "#059669",
    channels: ["Organic Social / Instagram", "Organic Social / Facebook", "Organic Search", "Direct"],
  },
  {
    label: "Outros",
    color: "#b45309",
    channels: ["Clube GoCase", "Referral", "Other"],
  },
];

function categoryOf(channel: string) {
  return CATEGORY_MAP.find((c) => c.channels.includes(channel)) ?? CATEGORY_MAP[3];
}

function compactLabel(ch: string) {
  return ch
    .replace("Google Ads / ", "GA/")
    .replace("Organic Social / ", "Org/")
    .replace("Paid Meta Ads", "Meta")
    .replace("Display / Retargeting", "Display")
    .replace("WhatsApp CRM", "WhatsApp");
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[m - 1] + sorted[m]) / 2 : sorted[m];
}

function fmtDuration(s: number) {
  if (s < 60) return `${Math.round(s)}s`;
  return `${(s / 60).toFixed(1)} min`;
}

// ── Quadrant scatter ─────────────────────────────────────────────────────────

type ScatterPoint = {
  x: number;
  y: number;
  z: number;
  channel: string;
  sessions: number;
  avg_bounce_rate: number;
  avg_pageviews: number;
  color: string;
};

function QuadrantTooltip({ active, payload }: { active?: boolean; payload?: { payload: ScatterPoint }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 12, boxShadow: "0 2px 8px #0001" }}>
      <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>{d.channel}</div>
      <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "2px 12px", color: "#475569" }}>
        <span>Duração:</span> <strong>{fmtDuration(d.x)}</strong>
        <span>Markov:</span> <strong>{d.y.toFixed(2)}%</strong>
        <span>Sessões:</span> <strong>{d.sessions.toLocaleString("pt-BR")}</strong>
        <span>Pageviews:</span> <strong>{d.avg_pageviews.toFixed(1)}</strong>
        <span>Bounce:</span> <strong>{(d.avg_bounce_rate * 100).toFixed(1)}%</strong>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomDot(props: any) {
  const { cx, cy, payload } = props as { cx: number; cy: number; payload: ScatterPoint };
  const r = Math.max((props.r ?? 8), 5);
  // Show label for channels with > 2% Markov or > 1M sessions
  const showLabel = payload.y > 2 || payload.sessions > 1_000_000;
  const label = compactLabel(payload.channel);
  return (
    <g>
      <circle
        cx={cx} cy={cy} r={r}
        fill={payload.color}
        fillOpacity={0.82}
        stroke="#fff"
        strokeWidth={1.5}
      />
      {showLabel && (
        <text
          x={cx}
          y={cy - r - 5}
          textAnchor="middle"
          fontSize={10}
          fill="#1e293b"
          fontWeight={600}
          stroke="#fff"
          strokeWidth={3}
          paintOrder="stroke"
        >
          {label}
        </text>
      )}
    </g>
  );
}

// Quadrant label placed at fixed SVG coordinates inside the chart
function QuadrantLabel({ cx, cy, text, color }: { cx: number; cy: number; text: string; color: string }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" fontSize={10} fill={color} fontWeight={700} opacity={0.7}>
      {text}
    </text>
  );
}

function QuadrantChart({
  data,
  medianX,
  medianY,
}: {
  data: ScatterPoint[];
  medianX: number;
  medianY: number;
}) {
  // Exclude catch-all "Other" (inflated duration from bots/noise)
  const filtered = data.filter((d) => d.channel !== "Other");

  const xMin = 10;
  const xMax = Math.min(
    Math.max(...filtered.map((d) => d.x)) * 1.15,
    900  // cap at 15 min — extreme outliers excluded
  );
  const yMax = Math.max(...filtered.map((d) => d.y)) * 1.2;

  const byCategory = CATEGORY_MAP.map((cat) => ({
    ...cat,
    points: filtered.filter((d) => d.color === cat.color),
  })).filter((g) => g.points.length > 0);

  return (
    <div className="panel">
      <h3 className="panel-title">Engajamento × Atribuição — Mapa de Posicionamento</h3>
      <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
        Eixo X (log) = duração média da sessão · Eixo Y = peso Markov · Tamanho = volume de sessões.
        Linhas tracejadas = mediana de cada eixo.
      </p>
      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 24, right: 40, bottom: 36, left: 20 }}>
          {/* Colored quadrant backgrounds */}
          <ReferenceArea x1={xMin} x2={medianX} y1={0}       y2={medianY} fill="#fef9c3" fillOpacity={0.55} />
          <ReferenceArea x1={medianX} x2={xMax}  y1={0}       y2={medianY} fill="#dcfce7" fillOpacity={0.45} />
          <ReferenceArea x1={xMin} x2={medianX} y1={medianY} y2={yMax}    fill="#fef3c7" fillOpacity={0.55} />
          <ReferenceArea x1={medianX} x2={xMax}  y1={medianY} y2={yMax}   fill="#bbf7d0" fillOpacity={0.55} />

          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            type="number"
            dataKey="x"
            scale="log"
            domain={[xMin, xMax]}
            tickFormatter={fmtDuration}
            name="Duração (s)"
            label={{ value: "Duração média da sessão (escala log)", position: "insideBottom", offset: -20, fontSize: 11, fill: "#64748b" }}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, yMax]}
            tickFormatter={(v) => `${v.toFixed(1)}%`}
            name="Markov %"
            label={{ value: "Atribuição Markov %", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "#64748b" }}
            tick={{ fontSize: 11 }}
            width={52}
          />
          <ZAxis type="number" dataKey="z" range={[40, 480]} name="Sessões" />
          <Tooltip content={<QuadrantTooltip />} cursor={{ strokeDasharray: "3 3" }} />

          {/* Quadrant divider lines */}
          <ReferenceLine x={medianX} stroke="#94a3b8" strokeDasharray="5 3" strokeWidth={1.5} />
          <ReferenceLine y={medianY} stroke="#94a3b8" strokeDasharray="5 3" strokeWidth={1.5} />

          {/* Quadrant labels as customized reference lines */}
          <ReferenceLine
            x={xMin * 1.5} y={yMax * 0.88}
            label={<QuadrantLabel cx={0} cy={0} text="Volume s/ Qualidade" color="#92400e" />}
            stroke="none"
          />
          <ReferenceLine
            x={xMax * 0.85} y={yMax * 0.88}
            label={<QuadrantLabel cx={0} cy={0} text="⭐ Estrelas" color="#15803d" />}
            stroke="none"
          />
          <ReferenceLine
            x={xMin * 1.5} y={medianY * 0.2}
            label={<QuadrantLabel cx={0} cy={0} text="Baixa Prioridade" color="#94a3b8" />}
            stroke="none"
          />
          <ReferenceLine
            x={xMax * 0.85} y={medianY * 0.2}
            label={<QuadrantLabel cx={0} cy={0} text="Potencial Oculto" color="#1d4ed8" />}
            stroke="none"
          />

          <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
          {byCategory.map((cat) => (
            <Scatter key={cat.label} name={cat.label} data={cat.points} fill={cat.color} shape={<CustomDot />} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Conv vs Non-conv duration bars ───────────────────────────────────────────

function DurationSplitChart({ data }: { data: MergedRow[] }) {
  const sorted = [...data]
    .filter((d) => d.channel !== "Other" && ((d.conv_avg_duration_s ?? 0) > 0 || (d.nonconv_avg_duration_s ?? 0) > 0))
    .sort((a, b) => (b.avg_duration_s ?? 0) - (a.avg_duration_s ?? 0))
    .slice(0, 14)
    .map((d) => ({
      channel: compactLabel(d.channel),
      Converteu: Math.round(d.conv_avg_duration_s ?? 0),
      "Não converteu": Math.round(d.nonconv_avg_duration_s ?? 0),
    }));

  return (
    <div className="panel">
      <h3 className="panel-title">Duração de Sessão: Converteu vs Não Converteu</h3>
      <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
        Canais onde conversores ficam muito mais tempo sinalizam alta intenção de compra naquele touchpoint.
      </p>
      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={sorted} layout="vertical" margin={{ left: 10, right: 30, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <YAxis type="category" dataKey="channel" width={110} tick={{ fontSize: 11 }} />
          <XAxis type="number" tickFormatter={(v) => fmtDuration(v)} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => fmtDuration(Number(v))} />
          <Legend />
          <Bar dataKey="Converteu" fill="#16a34a" radius={[0, 3, 3, 0]} />
          <Bar dataKey="Não converteu" fill="#94a3b8" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Engagement Score cards ───────────────────────────────────────────────────

function engagementScore(d: SessionQualityRow) {
  const dur = d.avg_duration_s ?? 0;
  const pv = d.avg_pageviews ?? 1;
  const ev = d.avg_events ?? 1;
  const bounce = d.avg_bounce_rate ?? 0.5;
  return Math.round(dur * pv * ev * (1 - bounce));
}

type MergedRow = SessionQualityRow & { markov_pct: number };

function InsightCards({ data }: { data: MergedRow[] }) {
  const scored = [...data]
    .filter((d) => d.channel !== "Other")
    .map((d) => ({ ...d, score: engagementScore(d) }))
    .sort((a, b) => b.score - a.score);

  const top3 = scored.slice(0, 3);
  const bottom3 = scored.slice(-3).reverse();

  const Card = ({ d, rank, highlight }: { d: MergedRow & { score: number }; rank: number; highlight: "green" | "red" }) => {
    const cat = categoryOf(d.channel);
    const borderColor = highlight === "green" ? "#16a34a" : "#dc2626";
    return (
      <div style={{
        border: `1px solid ${borderColor}28`,
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: 10, padding: "12px 16px", background: "#fff",
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 20, height: 20, borderRadius: "50%", background: borderColor, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, flexShrink: 0,
          }}>{rank}</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{d.channel}</span>
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: `${cat.color}18`, color: cat.color, fontWeight: 600 }}>
            {cat.label}
          </span>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
          <span>⏱ {fmtDuration(d.avg_duration_s ?? 0)}</span>
          <span>📄 {(d.avg_pageviews ?? 0).toFixed(1)} páginas</span>
          <span>⚡ {(d.avg_events ?? 0).toFixed(0)} eventos</span>
          <span>↩ {((d.avg_bounce_rate ?? 0) * 100).toFixed(1)}% bounce</span>
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>
          Score: <strong style={{ color: "#0f172a" }}>{d.score.toLocaleString("pt-BR")}</strong>
          &nbsp;·&nbsp;{(d.sessions ?? 0).toLocaleString("pt-BR")} sessões
          {d.markov_pct > 0 && <>&nbsp;·&nbsp;Markov {d.markov_pct.toFixed(2)}%</>}
        </div>
      </div>
    );
  };

  return (
    <div className="panel">
      <h3 className="panel-title">Score de Engajamento por Canal</h3>
      <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
        Score = duração × pageviews × eventos × (1 − bounce). Mede a profundidade real da sessão.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Maior engajamento
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {top3.map((d, i) => <Card key={d.channel} d={d} rank={i + 1} highlight="green" />)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Menor engajamento
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {bottom3.map((d, i) => <Card key={d.channel} d={d} rank={i + 1} highlight="red" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Metrics table ─────────────────────────────────────────────────────────────

function MetricsTable({ data }: { data: MergedRow[] }) {
  const sorted = [...data].sort((a, b) => (b.sessions ?? 0) - (a.sessions ?? 0));
  const maxDur = Math.max(...sorted.map((d) => d.avg_duration_s ?? 0), 1);

  return (
    <div className="panel">
      <h3 className="panel-title">Métricas Completas por Canal</h3>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Canal</th>
              <th style={{ textAlign: "right" }}>Sessões</th>
              <th>Duração média</th>
              <th style={{ textAlign: "right" }}>Pageviews</th>
              <th style={{ textAlign: "right" }}>Eventos</th>
              <th style={{ textAlign: "right" }}>Bounce</th>
              <th style={{ textAlign: "right" }}>Markov %</th>
              <th style={{ textAlign: "right" }}>Dur. (conv)</th>
              <th style={{ textAlign: "right" }}>Dur. (n-conv)</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const cat = categoryOf(row.channel);
              const pct = (row.avg_duration_s ?? 0) / maxDur;
              const bounce = row.avg_bounce_rate ?? 0;
              return (
                <tr key={row.channel}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
                      {row.channel}
                    </div>
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {(row.sessions ?? 0).toLocaleString("pt-BR")}
                  </td>
                  <td style={{ minWidth: 130 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${pct * 100}%`, height: "100%", background: cat.color, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                        {fmtDuration(row.avg_duration_s ?? 0)}
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>{(row.avg_pageviews ?? 0).toFixed(1)}</td>
                  <td style={{ textAlign: "right" }}>{(row.avg_events ?? 0).toFixed(0)}</td>
                  <td style={{ textAlign: "right" }}>
                    <span style={{ color: bounce > 0.15 ? "#dc2626" : bounce > 0.05 ? "#b45309" : "#16a34a" }}>
                      {(bounce * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {row.markov_pct > 0 ? `${row.markov_pct.toFixed(2)}%` : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {row.conv_avg_duration_s ? fmtDuration(row.conv_avg_duration_s) : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {row.nonconv_avg_duration_s ? fmtDuration(row.nonconv_avg_duration_s) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function SessionQualityView({
  sessionQuality,
  channels,
}: {
  sessionQuality: SessionQualityRow[];
  channels: ChannelRow[];
}) {
  const merged = useMemo<MergedRow[]>(() => {
    const chMap = Object.fromEntries(channels.map((c) => [c.channel, c]));
    return sessionQuality.map((sq) => ({
      ...sq,
      markov_pct: (chMap[sq.channel]?.markov_weight ?? 0) * 100,
    }));
  }, [sessionQuality, channels]);

  const scatterData = useMemo<ScatterPoint[]>(
    () =>
      merged.map((d) => ({
        x: Math.max(d.avg_duration_s ?? 1, 5), // log scale needs > 0
        y: d.markov_pct,
        z: Math.max(Math.sqrt(d.sessions ?? 1) * 9, 35),
        channel: d.channel,
        sessions: d.sessions ?? 0,
        avg_bounce_rate: d.avg_bounce_rate ?? 0,
        avg_pageviews: d.avg_pageviews ?? 0,
        color: categoryOf(d.channel).color,
      })),
    [merged],
  );

  const medianX = useMemo(
    () => median(scatterData.filter((d) => d.channel !== "Other").map((d) => d.x)),
    [scatterData],
  );
  const medianY = useMemo(
    () => median(scatterData.filter((d) => d.channel !== "Other").map((d) => d.y)),
    [scatterData],
  );

  if (sessionQuality.length === 0) {
    return (
      <div className="panel" style={{ textAlign: "center", padding: 48 }}>
        <p style={{ color: "#64748b", fontSize: 14 }}>
          Dados de qualidade de sessão disponíveis apenas em novos model runs.
          <br />
          Crie um novo run para ver estas métricas.
        </p>
      </div>
    );
  }

  return (
    <div className="panel-stack">
      <InsightCards data={merged} />
      <QuadrantChart data={scatterData} medianX={medianX} medianY={medianY} />
      <DurationSplitChart data={merged} />
      <MetricsTable data={merged} />
    </div>
  );
}
