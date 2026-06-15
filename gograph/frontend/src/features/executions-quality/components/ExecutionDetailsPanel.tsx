import { X, RefreshCw, EllipsisVertical } from "lucide-react";
import { Badge, Button, Card, Tabs } from "../../../shared/ui";
import type { Tone } from "../../../shared/tokens/tokens";
import type {
  ExecutionDetailsPanelData,
  ExecutionDetailsTab,
} from "../types";

import styles from "./ExecutionDetailsPanel.module.css";

export type ExecutionDetailsPanelProps = {
  panel: ExecutionDetailsPanelData;
  onReexecute?: () => void;
  onClose?: () => void;
  onMoreActions?: () => void;
};

const statusTone: Record<string, Tone> = {
  Concluído: "green",
  "Em processamento": "blue",
  Atenção: "orange",
  Erro: "red",
};

export function ExecutionDetailsPanel({
  panel,
  onReexecute,
  onClose,
  onMoreActions,
}: ExecutionDetailsPanelProps) {
  return (
    <Card>
      <Card.Header>
        <div className={styles.headerRow}>
          <div className={styles.titleBlock}>
            <Card.Title>{panel.title}</Card.Title>
            <div className={styles.subhead}>
              <span className={styles.period}>{panel.period}</span>
              <span className={styles.metaRow}>
                <Badge tone={statusTone[panel.status] ?? "neutral"} size="sm">
                  {panel.status}
                </Badge>
                <span className={styles.metaSep}>•</span>
                <span>{panel.createdAt}</span>
                <span className={styles.metaSep}>•</span>
                <span>{panel.createdBy}</span>
              </span>
            </div>
          </div>
          <Button
            variant="icon"
            size="sm"
            aria-label="Fechar painel"
            onClick={onClose}
          >
            <X size={14} />
          </Button>
        </div>
      </Card.Header>
      <Card.Body>
        <div className={styles.body}>
          <Tabs.Root defaultValue={panel.activeTab}>
            <Tabs.List>
              {panel.tabs.map((tab) => (
                <Tabs.Trigger key={tab} value={tab}>
                  {tab}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <Tabs.Content
              value={"Parâmetros" satisfies ExecutionDetailsTab}
              className={styles.tabContent}
            >
              <dl className={styles.params}>
                {panel.modelParameters.map((p) => (
                  <div key={p.label} style={{ display: "contents" }}>
                    <dt>{p.label}</dt>
                    <dd>{p.value}</dd>
                  </div>
                ))}
              </dl>
            </Tabs.Content>
            <Tabs.Content
              value={"Entradas" satisfies ExecutionDetailsTab}
              className={styles.tabContent}
            >
              <div className={styles.placeholder}>Em construção</div>
            </Tabs.Content>
            <Tabs.Content
              value={"Saídas" satisfies ExecutionDetailsTab}
              className={styles.tabContent}
            >
              <div className={styles.placeholder}>Em construção</div>
            </Tabs.Content>
            <Tabs.Content
              value={"Logs" satisfies ExecutionDetailsTab}
              className={styles.tabContent}
            >
              <div className={styles.placeholder}>Em construção</div>
            </Tabs.Content>
          </Tabs.Root>

          <div className={styles.notes}>
            <div className={styles.notesHeader}>
              <h3 className={styles.notesTitle}>{panel.notes.title}</h3>
              <button type="button" className={styles.action}>
                {panel.notes.action}
              </button>
            </div>
            <p className={styles.notesValue}>{panel.notes.value}</p>
          </div>

          <div className={styles.confidenceBox}>
            <h3 className={styles.confidenceTitle}>{panel.confidenceBox.title}</h3>
            <p className={styles.confidenceDescription}>
              {panel.confidenceBox.description}
            </p>
            <button type="button" className={styles.action}>
              {panel.confidenceBox.action}
            </button>
          </div>
        </div>
      </Card.Body>
      <Card.Footer>
        <div className={styles.footerRow}>
          <Button
            variant="secondary"
            iconLeft={<RefreshCw size={14} />}
            onClick={onReexecute}
          >
            Reexecutar
          </Button>
          <Button
            variant="icon"
            size="sm"
            aria-label="Mais ações"
            onClick={onMoreActions}
          >
            <EllipsisVertical size={14} />
          </Button>
        </div>
      </Card.Footer>
    </Card>
  );
}
