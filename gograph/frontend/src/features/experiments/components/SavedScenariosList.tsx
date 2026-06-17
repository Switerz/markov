import { RotateCw, Trash2 } from "lucide-react";
import { Badge, Button, Card } from "../../../shared/ui";
import type { SavedScenario } from "../hooks/useScenarios";
import styles from "./SavedScenariosList.module.css";

export type SavedScenariosListProps = {
  scenarios: SavedScenario[];
  loading?: boolean;
  onAnalyze: (scenarioId: number) => void;
  onDelete: (scenarioId: number) => void;
  busyScenarioId?: number | null;
};

function formatAnalyzedAt(value: string | null | undefined) {
  if (!value) return "Não analisado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function actionLabel(actionType: SavedScenario["action_type"]) {
  const labels: Record<SavedScenario["action_type"], string> = {
    removeChannel: "Remover",
    reducePresence: "Reduzir",
    redistributeBudget: "Redistribuir",
    compareModels: "Comparar",
    path: "Caminho",
  };
  return labels[actionType] ?? actionType;
}

export function SavedScenariosList({
  scenarios,
  loading,
  onAnalyze,
  onDelete,
  busyScenarioId,
}: SavedScenariosListProps) {
  return (
    <Card id="all-scenarios">
      <Card.Header>
        <Card.Title>Cenários salvos</Card.Title>
        <Card.Description>
          Histórico auditável por execução; reanalisar atualiza a versão salva.
        </Card.Description>
      </Card.Header>
      <Card.Body>
        {loading ? (
          <div className={styles.state}>Carregando cenários…</div>
        ) : scenarios.length === 0 ? (
          <div className={styles.state}>
            Nenhum cenário salvo para a execução atual.
          </div>
        ) : (
          <ul className={styles.list}>
            {scenarios.map((scenario) => {
              const analysis = scenario.analysis;
              const isBusy = busyScenarioId === scenario.id;
              return (
                <li key={scenario.id} className={styles.item}>
                  <div className={styles.main}>
                    <div className={styles.titleRow}>
                      <strong>{scenario.name}</strong>
                      <Badge tone={analysis ? "green" : "orange"} size="sm">
                        {analysis ? "Analisado" : "Pendente"}
                      </Badge>
                    </div>
                    <span className={styles.meta}>
                      {actionLabel(scenario.action_type)}
                      {scenario.channel ? ` · ${scenario.channel}` : ""}
                      {scenario.intensity_pct != null
                        ? ` · ${scenario.intensity_pct}%`
                        : ""}
                    </span>
                    <span
                      className={styles.version}
                      title={
                        analysis
                          ? `Analisado em ${analysis.analyzed_at ?? "-"} com versão ${analysis.code_version ?? "-"}`
                          : "Análise ainda não executada"
                      }
                    >
                      {formatAnalyzedAt(analysis?.analyzed_at)} · versão{" "}
                      {analysis?.code_version ?? "-"}
                    </span>
                  </div>
                  <div className={styles.actions}>
                    <Button
                      variant="secondary"
                      size="sm"
                      iconLeft={<RotateCw size={13} aria-hidden />}
                      loading={isBusy}
                      onClick={() => onAnalyze(scenario.id)}
                    >
                      Reanalisar
                    </Button>
                    <Button
                      variant="icon"
                      size="sm"
                      aria-label={`Excluir ${scenario.name}`}
                      onClick={() => onDelete(scenario.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}
