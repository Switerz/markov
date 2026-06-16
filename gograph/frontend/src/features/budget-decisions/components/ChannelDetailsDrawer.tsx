import { Link, useNavigate } from "react-router-dom";
import {
  Drawer,
  Badge,
  Button,
  MetricCard,
  Tabs,
  StatDelta,
  useToast,
  type StatTone,
} from "../../../shared/ui";
import {
  channelIcon,
  channelInitial,
} from "../../../shared/icons/channelIcons";
import { TrendingUp } from "lucide-react";
import type { SelectedChannelDrawer } from "../types";
import { slugify } from "../../../shared/format/slug";
import { RecommendedActionSimulator } from "./RecommendedActionSimulator";
import styles from "./ChannelDetailsDrawer.module.css";

export type ChannelDetailsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drawer: SelectedChannelDrawer;
};

const parseDeltaSign = (s: string): StatTone =>
  s.trim().startsWith("-") ? "negative" : "positive";

function ChannelHeaderTitle({
  channel,
  recommendation,
  tone,
}: {
  channel: string;
  recommendation: string;
  tone: SelectedChannelDrawer["tone"];
}) {
  const icon = channelIcon(channel, 16);
  return (
    <span className={styles.titleSlot}>
      <span className={styles.channelIcon} aria-hidden>
        {icon ?? channelInitial(channel)}
      </span>
      <span className={styles.channelName}>{channel}</span>
      <Badge tone={tone} variant="soft">
        {recommendation}
      </Badge>
    </span>
  );
}

function ResumoTab({ drawer }: { drawer: SelectedChannelDrawer }) {
  const slug = slugify(drawer.channel);
  const toast = useToast();
  const navigate = useNavigate();
  return (
    <div className={styles.tabBody}>
      <div className={styles.metrics}>
        {drawer.metrics.map((m) => (
          <MetricCard
            key={m.title}
            flat
            title={m.title}
            value={m.value}
            icon={<TrendingUp size={16} aria-hidden />}
            tone="blue"
            delta={{
              value: m.delta,
              label: "vs período anterior",
              tone: parseDeltaSign(m.delta),
            }}
          />
        ))}
      </div>

      <section className={styles.section}>
        <header className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>
            {drawer.recommendationCard.title}
          </h3>
          <Badge tone={drawer.tone} variant="soft">
            {drawer.recommendationCard.badge}
          </Badge>
        </header>
        <p className={styles.sectionText}>
          {drawer.recommendationCard.description}
        </p>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Por que essa recomendação</h3>
        <ul className={styles.rationaleList}>
          {drawer.rationale.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Papel na jornada</h3>
        <div className={styles.roleBlock}>
          <span className={styles.roleLabel}>
            {drawer.journeyRole.label}
          </span>
          <span className={styles.roleDescription}>
            {drawer.journeyRole.description}
          </span>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Transições</h3>
        <div className={styles.transitions}>
          <div className={styles.transitionColumn}>
            <span className={styles.transitionHeader}>Antes</span>
            <ul className={styles.transitionList}>
              {drawer.transitions.before.map((t) => (
                <li key={`b-${t.channel}`} className={styles.transitionRow}>
                  <span>{t.channel}</span>
                  <span className={styles.transitionValue}>
                    <StatDelta value={t.value} tone="neutral" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.transitionColumn}>
            <span className={styles.transitionHeader}>Depois</span>
            <ul className={styles.transitionList}>
              {drawer.transitions.after.map((t) => (
                <li key={`a-${t.channel}`} className={styles.transitionRow}>
                  <span>{t.channel}</span>
                  <span className={styles.transitionValue}>
                    <StatDelta value={t.value} tone="neutral" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <RecommendedActionSimulator action={drawer.suggestedAction} />

      <footer className={styles.actions}>
        <Link
          to={`/decisoes-de-budget/canais/${slug}`}
          className={styles.linkButton}
        >
          Ver canal 360
        </Link>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => navigate("/experimentos")}
        >
          Ir para Experimentos
        </Button>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() =>
            toast.push("Em breve — abrir tela de cenários", "blue")
          }
        >
          Criar cenário
        </Button>
      </footer>
    </div>
  );
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className={styles.placeholder}>
      <p>{label} - em construção.</p>
    </div>
  );
}

export function ChannelDetailsDrawer({
  open,
  onOpenChange,
  drawer,
}: ChannelDetailsDrawerProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      modal={false}
      showOverlay={false}
      dismissOnInteractOutside={false}
      width={420}
      title={
        <ChannelHeaderTitle
          channel={drawer.channel}
          recommendation={drawer.recommendation}
          tone={drawer.tone}
        />
      }
    >
      <Tabs.Root defaultValue="Resumo" className={styles.tabsRoot}>
        <Tabs.List>
          {drawer.tabs.map((t) => (
            <Tabs.Trigger key={t} value={t}>
              {t}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="Resumo">
          <ResumoTab drawer={drawer} />
        </Tabs.Content>
        <Tabs.Content value="Jornada">
          <PlaceholderTab label="Jornada" />
        </Tabs.Content>
        <Tabs.Content value="Impactos">
          <PlaceholderTab label="Impactos" />
        </Tabs.Content>
        <Tabs.Content value="Cenários">
          <PlaceholderTab label="Cenários" />
        </Tabs.Content>
      </Tabs.Root>
    </Drawer>
  );
}
