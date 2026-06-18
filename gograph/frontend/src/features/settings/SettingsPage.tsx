import { useState } from "react";
import { TopBar } from "../../app/TopBar";
import { Button, Card, Select, Slider, useToast } from "../../shared/ui";
import {
  DEFAULT_MODEL_DEFAULTS,
  useModelDefaults,
  type ModelDefaults,
} from "./useModelDefaults";
import styles from "./SettingsPage.module.css";

export function SettingsPage() {
  const { defaults, setDefaults, resetDefaults } = useModelDefaults();
  const [draft, setDraft] = useState<ModelDefaults>(defaults);
  const toast = useToast();

  function update<K extends keyof ModelDefaults>(key: K, value: ModelDefaults[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    setDefaults(draft);
    toast.push("Parâmetros salvos. Novas execuções usarão esses valores.", "green");
  }

  function reset() {
    resetDefaults();
    setDraft(DEFAULT_MODEL_DEFAULTS);
    toast.push("Parâmetros restaurados para o padrão.", "blue");
  }

  return (
    <>
      <TopBar title="Configurações" />
      <div className={styles.page}>
        <Card>
          <Card.Header>
            <Card.Title>Parâmetros do modelo</Card.Title>
            <Card.Description>
              Estes valores viram o padrão da próxima execução. Antes ficavam apenas no
              <code> .env </code>; aqui são editáveis e persistem no navegador.
            </Card.Description>
          </Card.Header>
          <Card.Body>
            <div className={styles.grid}>
              <label className={styles.field}>
                <span className={styles.label}>Shapley samples</span>
                <input
                  type="number"
                  min={100}
                  max={50_000}
                  step={100}
                  value={draft.shapley_samples}
                  onChange={(e) => update("shapley_samples", Number(e.target.value))}
                  className={styles.input}
                />
                <span className={styles.hint}>
                  Monte Carlo amostras p/ Shapley. Mais = mais preciso, mais lento.
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>
                  Decay λ <span className={styles.hintInline}>({draft.decay_lambda.toFixed(2)})</span>
                </span>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={[draft.decay_lambda]}
                  onValueChange={(v) => update("decay_lambda", v[0] ?? 0)}
                />
                <span className={styles.hint}>
                  Decaimento exponencial das transições de conversão por idade da sessão.
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Lookback (dias até conversão)</span>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={draft.lookback_days}
                  onChange={(e) => update("lookback_days", Number(e.target.value))}
                  className={styles.input}
                />
                <span className={styles.hint}>
                  Janela máxima entre o primeiro toque e a conversão.
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Censorship (dias)</span>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={draft.censorship_days}
                  onChange={(e) => update("censorship_days", Number(e.target.value))}
                  className={styles.input}
                />
                <span className={styles.hint}>
                  Exclui não-conversores cuja última sessão é &lt; X dias do fim da janela.
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Amostragem de não-conversores (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={draft.non_conv_sample_pct}
                  onChange={(e) => update("non_conv_sample_pct", Number(e.target.value))}
                  className={styles.input}
                />
                <span className={styles.hint}>
                  Fração dos usuários sem conversão que entram no modelo (mantém tratável).
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Non-conv scale (auto se vazio)</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={draft.non_conv_scale ?? ""}
                  onChange={(e) =>
                    update(
                      "non_conv_scale",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                  className={styles.input}
                />
                <span className={styles.hint}>
                  Reescala manual; deixe vazio para calibrar automaticamente pela taxa observada.
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Modo de lote</span>
                <Select
                  value={draft.batch_mode}
                  onValueChange={(v) => update("batch_mode", v as ModelDefaults["batch_mode"])}
                  ariaLabel="Modo de lote"
                >
                  <Select.Item value="auto">auto</Select.Item>
                  <Select.Item value="always">always</Select.Item>
                  <Select.Item value="never">never</Select.Item>
                </Select>
                <span className={styles.hint}>
                  Quebra a extração de transições por mês para evitar OOM no ClickHouse.
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Dias por lote</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={draft.batch_days}
                  onChange={(e) => update("batch_days", Number(e.target.value))}
                  className={styles.input}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>DB Plausible (ClickHouse)</span>
                <input
                  type="number"
                  min={0}
                  value={draft.db_plausible}
                  onChange={(e) => update("db_plausible", Number(e.target.value))}
                  className={styles.input}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>DB Datamart</span>
                <input
                  type="number"
                  min={0}
                  value={draft.db_datamart ?? ""}
                  onChange={(e) =>
                    update(
                      "db_datamart",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                  className={styles.input}
                />
              </label>
            </div>
          </Card.Body>
          <Card.Footer>
            <div className={styles.footerActions}>
              <Button variant="secondary" onClick={reset}>
                Restaurar padrões
              </Button>
              <Button variant="primary" onClick={save}>
                Salvar parâmetros
              </Button>
            </div>
          </Card.Footer>
        </Card>
      </div>
    </>
  );
}
