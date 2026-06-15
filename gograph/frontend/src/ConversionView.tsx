import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChannelRow, ModelRun, PathRow } from "./api";

// ── Formatters ───────────────────────────────────────────────────────────────

const fmtMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const fmtPct = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 2,
});
const fmtNum = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

const CRM_CHANNELS = ["Email", "WhatsApp CRM", "SMS"];
const CRM_COLORS: Record<string, string> = {
  "Email": "#7c3aed",
  "WhatsApp CRM": "#16a34a",
  "SMS": "#0ea5e9",
};

function compactPath(path: string, maxLen = 38): string {
  if (path.length <= maxLen) return path;
  const steps = path.split(" → ");
  if (steps.length <= 2) return path.slice(0, maxLen) + "…";
  return `${steps[0]} → … → ${steps[steps.length - 1]}`;
}

function compactChannel(ch: string): string {
  return ch
    .replace("Google Ads / ", "GA/")
    .replace("Organic Social / ", "Org/")
    .replace(" CRM", "");
}

function hasCRM(pathText: string): boolean {
  return CRM_CHANNELS.some((ch) => pathText.includes(ch));
}

function weightedAvgCR(list: PathRow[]): number | null {
  const total = list.reduce((s, p) => s + (p.count ?? 0), 0);
  if (total === 0) return null;
  return (
    list.reduce((s, p) => s + (p.conversion_rate ?? 0) * (p.count ?? 0), 0) /
    total
  );
}

// ─── 1. Simulador de Impacto ─────────────────────────────────────────────────

function ImpactSimulator({ run }: { run: ModelRun }) {
  const [delta, setDelta] = useState(0.5);
  const baseline = run.model_conversion_rate ?? 0.02;
  const lift = (baseline + delta / 100) / baseline;
  const incremental = run.total_revenue * (lift - 1);

  return (
    <section className="chart-band">
      <header>
        <h2>Simulador de Impacto de Conversão</h2>
        <span>
          Taxa base: {fmtPct.format(baseline)} · Receita atual:{" "}
          {fmtMoney.format(run.total_revenue)}
        </span>
      </header>
      <div className="simulator-body">
        <div className="simulator-slider-row">
          <span>
            Se aumentarmos a conversão em{" "}
            <strong className="simulator-delta">+{delta.toFixed(1)} pp</strong>
          </span>
          <input
            type="range"
            min={0.1}
            max={5.0}
            step={0.1}
            value={delta}
            onChange={(e) => setDelta(+e.target.value)}
            className="simulator-range"
          />
        </div>
        <div className="simulator-results">
          <div className="sim-kpi">
            <span className="sim-kpi-label">Receita incremental</span>
            <strong className="sim-kpi-value cell-positive">
              {fmtMoney.format(incremental)}
            </strong>
          </div>
          <div className="sim-kpi">
            <span className="sim-kpi-label">Lift de receita</span>
            <strong className="sim-kpi-value">{fmtNum.format(lift)}×</strong>
          </div>
          <div className="sim-kpi">
            <span className="sim-kpi-label">Nova taxa projetada</span>
            <strong className="sim-kpi-value">
              {fmtPct.format(baseline + delta / 100)}
            </strong>
          </div>
          <div className="sim-kpi">
            <span className="sim-kpi-label">Receita projetada</span>
            <strong className="sim-kpi-value">
              {fmtMoney.format(run.total_revenue * lift)}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 2. Last Click vs Multi-Touch ────────────────────────────────────────────

function LastClickVsMultiTouch({ channels }: { channels: ChannelRow[] }) {
  const totalLC = channels.reduce(
    (s, r) => s + (r.last_click_revenue ?? 0),
    0,
  );
  const totalMK = channels.reduce((s, r) => s + (r.markov_revenue ?? 0), 0);

  const data = useMemo(() => {
    if (totalLC === 0 || totalMK === 0) return [];
    return channels
      .filter((r) => (r.last_click_revenue ?? 0) > 0 || (r.markov_revenue ?? 0) > 0)
      .map((r) => ({
        channel: compactChannel(r.channel),
        full: r.channel,
        lc: +((r.last_click_revenue ?? 0) / totalLC * 100).toFixed(1),
        mk: +((r.markov_revenue ?? 0) / totalMK * 100).toFixed(1),
      }))
      .map((r) => ({ ...r, delta: +(r.mk - r.lc).toFixed(1) }))
      .sort((a, b) => b.delta - a.delta);
  }, [channels, totalLC, totalMK]);

  if (data.length === 0) return null;

  const deltaLabel = (d: number) =>
    d > 3
      ? "Muito subestimado"
      : d > 1
        ? "Subestimado"
        : d < -3
          ? "Last click supercredita"
          : d < -1
            ? "Leve sobrecreditação"
            : "Alinhado";

  return (
    <section className="chart-band">
      <header>
        <h2>Last Click vs Atribuição Multi-Touch</h2>
        <span>
          Divergência entre atribuição ingênua (último clique) e modelo Markov
        </span>
      </header>
      <div className="how-to-read">
        <strong>Como ler:</strong>{" "}
        <span style={{ color: "#2563eb", fontWeight: 600 }}>Markov %</span> vs{" "}
        <span style={{ color: "#94a3b8", fontWeight: 600 }}>Last Click %</span>{" "}
        de receita atribuída. Canal <em>acima da barra cinza</em> = subestimado
        pelo last click; <em>abaixo</em> = supercreditado (provavelmente captura
        conversões iniciadas por outros canais).
      </div>
      <ResponsiveContainer
        width="100%"
        height={Math.max(260, data.length * 30)}
      >
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="#e2e8f0"
          />
          <XAxis
            type="number"
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="channel"
            width={130}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(v, name) => [
              `${Number(v).toFixed(1)}%`,
              name as string,
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="lc"
            name="Last Click %"
            fill="#cbd5e1"
            radius={[0, 3, 3, 0]}
            maxBarSize={11}
          />
          <Bar
            dataKey="mk"
            name="Markov %"
            fill="#2563eb"
            radius={[0, 3, 3, 0]}
            maxBarSize={11}
          />
        </BarChart>
      </ResponsiveContainer>

      <div style={{ marginTop: 8, overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>Canal</th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>Last Click</th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>Markov</th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>Δ</th>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>Interpretação</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "4px 8px" }}><strong>{r.full}</strong></td>
                <td style={{ textAlign: "right", padding: "4px 8px", color: "#64748b" }}>{r.lc}%</td>
                <td style={{ textAlign: "right", padding: "4px 8px" }}>{r.mk}%</td>
                <td style={{ textAlign: "right", padding: "4px 8px" }}>
                  <span className={r.delta > 1 ? "cell-positive" : r.delta < -1 ? "cell-negative" : ""}>
                    {r.delta > 0 ? "+" : ""}{r.delta} pp
                  </span>
                </td>
                <td style={{ padding: "4px 8px", color: "#64748b", fontSize: 11 }}>
                  {deltaLabel(r.delta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── 3. Top Lift de Conversão ─────────────────────────────────────────────────

function LiftRanking({
  paths,
  baseline_cr,
}: {
  paths: PathRow[];
  baseline_cr: number;
}) {
  const MIN_SUPPORT = 5;

  const top = useMemo(() => {
    return paths
      .filter(
        (p) =>
          p.conversion_rate != null &&
          (p.count ?? 0) >= MIN_SUPPORT &&
          baseline_cr > 0,
      )
      .map((p) => ({
        ...p,
        lift: p.conversion_rate! / baseline_cr,
        crm: hasCRM(p.path_text ?? ""),
      }))
      .sort((a, b) => b.lift - a.lift)
      .slice(0, 15);
  }, [paths, baseline_cr]);

  if (top.length === 0) return null;

  const chartData = top.map((p) => ({
    path: compactPath(p.path_text ?? "", 30),
    lift: +p.lift.toFixed(2),
    crm: p.crm,
    full: p.path_text ?? "",
    count: p.count ?? 0,
    cr: p.conversion_rate ?? 0,
  }));

  return (
    <section className="chart-band">
      <header>
        <h2>Top 15 Caminhos por Lift de Conversão</h2>
        <span>
          Mín. {MIN_SUPPORT} jornadas · baseline ={" "}
          {fmtPct.format(baseline_cr)}
        </span>
      </header>
      <div className="how-to-read">
        <strong>Lift</strong> = taxa de conversão do caminho ÷ taxa média do
        modelo. Lift 2× = converte o dobro da média.{" "}
        <span style={{ color: "#2563eb", fontWeight: 600 }}>
          ● CRM no caminho
        </span>{" "}
        ·{" "}
        <span style={{ color: "#94a3b8", fontWeight: 600 }}>
          ● sem CRM
        </span>
      </div>
      <ResponsiveContainer
        width="100%"
        height={Math.max(300, top.length * 28)}
      >
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 4, right: 70, left: 8, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="#e2e8f0"
          />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v}×`}
          />
          <YAxis
            type="category"
            dataKey="path"
            width={200}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            formatter={(v) => [`${Number(v).toFixed(2)}×`, "Lift"]}
            labelFormatter={(_label, payload) =>
              payload?.[0]?.payload?.full ?? _label
            }
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <ReferenceLine
            x={1}
            stroke="#64748b"
            strokeDasharray="4 2"
            label={{ value: "baseline", fontSize: 10, fill: "#64748b", position: "insideTopRight" }}
          />
          <Bar dataKey="lift" radius={[0, 3, 3, 0]} maxBarSize={14}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.crm ? "#2563eb" : "#94a3b8"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

// ─── 4. Efeito do CRM por Posição ────────────────────────────────────────────

function CRMPositionEffect({
  paths,
  baseline_cr,
}: {
  paths: PathRow[];
  baseline_cr: number;
}) {
  const validPaths = paths.filter(
    (p) => p.conversion_rate != null && (p.count ?? 0) >= 2,
  );

  const rows = useMemo(() =>
    CRM_CHANNELS.map((ch) => {
      const withCRM = validPaths.filter((p) => p.path_text?.includes(ch));
      const withoutCRM = validPaths.filter((p) => !p.path_text?.includes(ch));
      const crWithout = weightedAvgCR(withoutCRM) ?? baseline_cr;
      const crWith = weightedAvgCR(withCRM);
      const totalWithCount = withCRM.reduce((s, p) => s + (p.count ?? 0), 0);

      const byPos = (["1º", "Meio", "Último"] as const).map(
        (posLabel, posIdx) => {
          const filtered = withCRM.filter((p) => {
            const steps = (p.path_text ?? "").split(" → ");
            const idx = steps.indexOf(ch);
            if (idx === -1) return false;
            if (posIdx === 0) return idx === 0;
            if (posIdx === 2) return idx === steps.length - 1;
            return idx > 0 && idx < steps.length - 1;
          });
          const cr = weightedAvgCR(filtered);
          const count = filtered.reduce((s, p) => s + (p.count ?? 0), 0);
          return {
            pos: posLabel,
            cr,
            lift: cr != null ? cr / crWithout : null,
            count,
          };
        },
      );

      return {
        channel: ch,
        crWith,
        crWithout,
        lift: crWith != null ? crWith / crWithout : null,
        totalWithCount,
        byPos,
      };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paths, baseline_cr],
  );

  if (!rows.some((r) => r.totalWithCount > 0)) return null;

  return (
    <section className="chart-band">
      <header>
        <h2>Efeito do CRM por Posição na Jornada</h2>
        <span>
          Lift de conversão quando cada canal CRM aparece em diferentes momentos
        </span>
      </header>
      <div className="how-to-read">
        <strong>Como ler:</strong> "Lift 2.3× no Meio" = jornadas onde este canal CRM
        aparece no meio convertem 2.3× mais que jornadas sem ele. Referência =
        taxa de conversão de jornadas sem o canal.
      </div>
      <div className="crm-effect-grid">
        {rows.map((r) => (
          <div key={r.channel} className="crm-effect-card">
            <div className="crm-effect-header">
              <span
                className="crm-effect-dot"
                style={{ background: CRM_COLORS[r.channel] ?? "#64748b" }}
              />
              <strong>{r.channel}</strong>
              <span className="muted-small">
                {r.totalWithCount.toLocaleString("pt-BR")} jornadas
              </span>
            </div>
            <div className="crm-effect-overall">
              Lift geral:{" "}
              <strong
                className={
                  r.lift != null && r.lift >= 1.2
                    ? "cell-positive"
                    : r.lift != null && r.lift < 0.9
                      ? "cell-negative"
                      : ""
                }
              >
                {r.lift != null ? `${fmtNum.format(r.lift)}×` : "n/d"}
              </strong>
              {r.crWith != null && (
                <span className="muted-small">
                  {" "}
                  ({fmtPct.format(r.crWith)} vs {fmtPct.format(r.crWithout)}{" "}
                  sem)
                </span>
              )}
            </div>
            <table className="crm-effect-table">
              <thead>
                <tr>
                  <th>Posição</th>
                  <th>Conv.</th>
                  <th>Lift</th>
                  <th>Jornadas</th>
                </tr>
              </thead>
              <tbody>
                {r.byPos.map((bp) => (
                  <tr key={bp.pos}>
                    <td>{bp.pos}</td>
                    <td>
                      {bp.cr != null ? fmtPct.format(bp.cr) : "—"}
                    </td>
                    <td>
                      <strong
                        className={
                          bp.lift != null && bp.lift >= 1.5
                            ? "cell-positive"
                            : bp.lift != null && bp.lift >= 1.2
                              ? "cell-positive"
                              : bp.lift != null && bp.lift < 0.9
                                ? "cell-negative"
                                : ""
                        }
                      >
                        {bp.lift != null
                          ? `${fmtNum.format(bp.lift)}×`
                          : "—"}
                      </strong>
                    </td>
                    <td style={{ color: "#64748b" }}>
                      {bp.count.toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── 5. Score de Oportunidade CRM ────────────────────────────────────────────

function CRMOpportunityScore({
  paths,
  baseline_cr,
}: {
  paths: PathRow[];
  baseline_cr: number;
}) {
  const totalJourneys = paths.reduce((s, p) => s + (p.count ?? 0), 0);
  const validPaths = paths.filter(
    (p) => p.conversion_rate != null && (p.count ?? 0) >= 2,
  );

  const scores = useMemo(() => {
    return CRM_CHANNELS.map((ch) => {
      const crmPaths = validPaths.filter((p) => p.path_text?.includes(ch));
      const totalCount = crmPaths.reduce((s, p) => s + (p.count ?? 0), 0);
      const avgCR = weightedAvgCR(crmPaths) ?? 0;
      const lift = baseline_cr > 0 ? avgCR / baseline_cr : 0;
      const coverage = totalJourneys > 0 ? totalCount / totalJourneys : 0;
      // Score = lift × √(cobertura%) — combina força do efeito com escala
      const score = lift * Math.sqrt(coverage * 100);

      const topPaths = crmPaths
        .filter((p) => p.conversion_rate != null && baseline_cr > 0)
        .map((p) => ({
          ...p,
          lift: p.conversion_rate! / baseline_cr,
        }))
        .sort((a, b) => b.lift - a.lift)
        .slice(0, 3);

      return { channel: ch, lift, coverage, score, totalCount, avgCR, topPaths };
    }).sort((a, b) => b.score - a.score);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths, baseline_cr, totalJourneys]);

  if (!scores.some((s) => s.totalCount > 0)) return null;

  const maxScore = Math.max(...scores.map((s) => s.score), 0.01);

  return (
    <section className="chart-band">
      <header>
        <h2>Score de Oportunidade CRM</h2>
        <span>Potencial de lift × cobertura de jornadas</span>
      </header>
      <div className="how-to-read">
        <strong>Score</strong> = lift médio × √(cobertura%) — combina a força
        do efeito com a escala de jornadas afetadas. Canal com score alto é o
        melhor candidato para acionamento incremental no fluxo de conversão.
      </div>
      <div className="crm-score-grid">
        {scores.map((s, rank) => (
          <div key={s.channel} className="crm-score-card">
            <div className="crm-score-rank-badge">#{rank + 1}</div>
            <div
              className="crm-score-name"
              style={{ color: CRM_COLORS[s.channel] ?? "#374151" }}
            >
              {s.channel}
            </div>
            <div className="crm-score-bar-wrap">
              <div
                className="crm-score-bar"
                style={{
                  width: `${(s.score / maxScore) * 100}%`,
                  background: CRM_COLORS[s.channel] ?? "#2563eb",
                }}
              />
            </div>
            <div className="crm-score-number">
              {fmtNum.format(s.score)}
              <span className="crm-score-label"> score</span>
            </div>
            <div className="crm-score-meta">
              <div className="crm-meta-row">
                <span className="crm-meta-key">Lift médio</span>
                <strong
                  className={s.lift >= 1.2 ? "cell-positive" : ""}
                >
                  {fmtNum.format(s.lift)}×
                </strong>
              </div>
              <div className="crm-meta-row">
                <span className="crm-meta-key">Cobertura</span>
                <strong>{fmtPct.format(s.coverage)}</strong>
              </div>
              <div className="crm-meta-row">
                <span className="crm-meta-key">Jornadas</span>
                <strong>{s.totalCount.toLocaleString("pt-BR")}</strong>
              </div>
              <div className="crm-meta-row">
                <span className="crm-meta-key">Conv. média</span>
                <strong>{fmtPct.format(s.avgCR)}</strong>
              </div>
            </div>
            {s.topPaths.length > 0 && (
              <div className="crm-top-paths">
                <span className="crm-top-paths-label">Top caminhos</span>
                {s.topPaths.map((p, i) => (
                  <div key={i} className="crm-top-path-row">
                    <span
                      className="crm-top-path-text"
                      title={p.path_text ?? ""}
                    >
                      {compactPath(p.path_text ?? "", 34)}
                    </span>
                    <span className="cell-positive">
                      {fmtNum.format(p.lift)}×
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function ConversionView({
  run,
  paths,
  channels,
}: {
  run: ModelRun;
  paths: PathRow[];
  channels: ChannelRow[];
}) {
  const baseline_cr = run.model_conversion_rate ?? 0.02;

  return (
    <div className="panel-stack">
      <ImpactSimulator run={run} />
      <LastClickVsMultiTouch channels={channels} />
      <LiftRanking paths={paths} baseline_cr={baseline_cr} />
      <CRMPositionEffect paths={paths} baseline_cr={baseline_cr} />
      <CRMOpportunityScore paths={paths} baseline_cr={baseline_cr} />
    </div>
  );
}
