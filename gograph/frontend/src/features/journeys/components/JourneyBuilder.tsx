import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Popover from "@radix-ui/react-popover";
import { Plus, X, Play, RotateCcw } from "lucide-react";
import { Card, Button, Select } from "../../../shared/ui";
import { channelIcon } from "../../../shared/icons/channelIcons";
import { useScenarioSimulation } from "../../../shared/hooks/useScenarioSimulation";
import type { JourneyBuilder as JourneyBuilderData, BuilderStep } from "../types";
import styles from "./JourneyBuilder.module.css";

export type JourneyBuilderProps = {
  builder: JourneyBuilderData;
};

type FormStep = { id: string; label: string };

const schema = z.object({
  steps: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().min(1),
      }),
    )
    .min(2, "Adicione ao menos 2 toques."),
});

type FormValues = z.infer<typeof schema>;

const AVAILABLE_CHANNELS = [
  "Organic Social",
  "Google Ads",
  "Meta Ads",
  "Direct",
  "WhatsApp CRM",
  "Email",
  "Outros",
  "Conversão",
  "Não converteu",
];

let counter = 0;
const nextId = () => `step-${++counter}`;

function stepsFromMock(path: BuilderStep[]): FormStep[] {
  return path.map((p) => ({ id: nextId(), label: p.label }));
}

export function JourneyBuilder({ builder }: JourneyBuilderProps) {
  const initialSteps = useMemo(() => stepsFromMock(builder.path), [builder.path]);
  const [steps, setSteps] = useState<FormStep[]>(initialSteps);
  const [error, setError] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [pendingChannel, setPendingChannel] = useState<string>(
    AVAILABLE_CHANNELS[0],
  );

  const result = useScenarioSimulation(
    steps,
    builder.estimatedInterpretation,
  );

  const { handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: { steps },
  });

  const onSubmit = handleSubmit(
    (values) => {
      setError(null);
      // TODO(api): replace with a real simulation call.
      // eslint-disable-next-line no-console
      console.log("[JourneyBuilder] simulate", values.steps);
    },
    (errors) => {
      setError(errors.steps?.message ?? "Caminho inválido.");
    },
  );

  const addStep = (label: string) => {
    setSteps((prev) => {
      // Insert before the final "Conversão" step if present, else append.
      const finalIdx = prev.findIndex(
        (s) => s.label === "Conversão" || s.label === "Não converteu",
      );
      const inserted = { id: nextId(), label };
      if (finalIdx === -1) return [...prev, inserted];
      return [
        ...prev.slice(0, finalIdx),
        inserted,
        ...prev.slice(finalIdx),
      ];
    });
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const reset = () => {
    setSteps(stepsFromMock(builder.path));
    setError(null);
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title>{builder.title}</Card.Title>
        <Card.Description>{builder.subtitle}</Card.Description>
      </Card.Header>
      <Card.Body>
        <form onSubmit={onSubmit} className={styles.body}>
          <div className={styles.pathRow} role="list" aria-label="Caminho">
            {steps.map((step, idx) => {
              const isOutcome =
                step.label === "Conversão" || step.label === "Não converteu";
              return (
                <span
                  key={step.id}
                  role="listitem"
                  className={`${styles.stepChip} ${
                    isOutcome ? styles.stepChipTone_green : ""
                  }`}
                >
                  {channelIcon(step.label, 14)}
                  <span>{step.label}</span>
                  <button
                    type="button"
                    className={styles.stepRemove}
                    onClick={() => removeStep(step.id)}
                    aria-label={`Remover ${step.label}`}
                  >
                    <X size={12} aria-hidden />
                  </button>
                  {idx < steps.length - 1 && (
                    <span className={styles.arrow} aria-hidden>
                      →
                    </span>
                  )}
                </span>
              );
            })}
            <Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
              <Popover.Trigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<Plus size={14} />}
                >
                  Adicionar touchpoint
                </Button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className={styles.popover}
                  sideOffset={6}
                  align="start"
                >
                  <Select
                    value={pendingChannel}
                    onValueChange={setPendingChannel}
                    ariaLabel="Canal a adicionar"
                  >
                    {AVAILABLE_CHANNELS.map((c) => (
                      <Select.Item key={c} value={c}>
                        {c}
                      </Select.Item>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => {
                      addStep(pendingChannel);
                      setPopoverOpen(false);
                    }}
                  >
                    Adicionar
                  </Button>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          <div className={styles.quickRow}>
            <span>Sugestões rápidas:</span>
            {builder.quickSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                className={styles.quickChip}
                onClick={() => addStep(s)}
              >
                {channelIcon(s, 12)}
                {s}
              </button>
            ))}
          </div>

          {error && <span className={styles.errorText}>{error}</span>}

          <div className={styles.interpretation}>
            <span className={styles.metricSubtitle}>
              Interpretação estimada — {result.description}
            </span>
            <div className={styles.interpretationGrid}>
              {result.metrics.map((m) => (
                <div key={m.title} className={styles.metricTile}>
                  <span className={styles.metricTitle}>{m.title}</span>
                  <span className={styles.metricValue}>{m.value}</span>
                  {m.subtitle && (
                    <span className={styles.metricSubtitle}>{m.subtitle}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </form>
      </Card.Body>
      <Card.Footer>
        <div className={styles.footerActions}>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<RotateCcw size={14} />}
            onClick={reset}
          >
            {builder.secondaryAction}
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Play size={14} />}
            onClick={() => onSubmit()}
          >
            {builder.primaryAction}
          </Button>
        </div>
      </Card.Footer>
    </Card>
  );
}
