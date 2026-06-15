import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Trash2,
  Activity,
  ChartNoAxesCombined,
  GitCompare,
  Play,
  Monitor,
  Calendar,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { Card, Button, Select, Slider } from "../../../shared/ui";
import type {
  ScenarioBuilder,
  ScenarioActionType,
  ScenarioField,
} from "../types";
import styles from "./ScenarioBuilderForm.module.css";

export type ScenarioBuilderFormValues = {
  channel: string;
  action: string;
  intensity: number;
  period: string;
  actionType: ScenarioActionType["id"];
};

export type ScenarioBuilderFormProps = {
  builder: ScenarioBuilder;
  onApply: (values: ScenarioBuilderFormValues) => void;
};

const actionTypeIcons: Record<ScenarioActionType["id"], LucideIcon> = {
  removeChannel: Trash2,
  reducePresence: Activity,
  redistributeBudget: ChartNoAxesCombined,
  compareModels: GitCompare,
};

// Static option sets — in a real integration these come from the API.
const CHANNEL_OPTIONS = [
  "Display",
  "Meta Ads",
  "Google Ads",
  "Email",
  "WhatsApp CRM",
  "Influencers",
];
const ACTION_OPTIONS = [
  "Remover canal",
  "Reduzir presença",
  "Redistribuir budget",
  "Comparar modelos",
];

const schema = z.object({
  channel: z.string().min(1),
  action: z.string().min(1),
  intensity: z.number().min(0).max(100),
  period: z.string(),
});

type SchemaValues = z.infer<typeof schema>;

function findField<T extends ScenarioField["id"]>(
  fields: ScenarioField[],
  id: T,
): Extract<ScenarioField, { id: T }> | undefined {
  return fields.find((f) => f.id === id) as
    | Extract<ScenarioField, { id: T }>
    | undefined;
}

export function ScenarioBuilderForm({
  builder,
  onApply,
}: ScenarioBuilderFormProps) {
  const channelField = findField(builder.fields, "channel");
  const actionField = findField(builder.fields, "action");
  const intensityField = findField(builder.fields, "intensity");
  const periodField = findField(builder.fields, "period");
  const advancedField = findField(builder.fields, "advancedOptions");
  const primaryIcon = builder.primaryAction.icon === "Play" ? <Play size={14} /> : null;

  const initialActionType = useMemo<ScenarioActionType["id"]>(() => {
    return builder.actionTypes.find((a) => a.active)?.id ?? builder.actionTypes[0].id;
  }, [builder.actionTypes]);

  const [activeActionType, setActiveActionType] = useState<
    ScenarioActionType["id"]
  >(initialActionType);

  const defaults = useMemo<SchemaValues>(
    () => ({
      channel: channelField?.value ?? CHANNEL_OPTIONS[0],
      action: actionField?.value ?? ACTION_OPTIONS[0],
      intensity: intensityField?.value ?? 100,
      period: periodField?.value ?? "",
    }),
    [channelField, actionField, intensityField, periodField],
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SchemaValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const onSubmit = handleSubmit((values) => {
    onApply({ ...values, actionType: activeActionType });
  });

  return (
    <Card>
      <Card.Header>
        <Card.Title>{builder.title}</Card.Title>
        <Card.Description>{builder.subtitle}</Card.Description>
      </Card.Header>
      <Card.Body>
        <form onSubmit={onSubmit} className={styles.form} aria-label={builder.title}>
          <section className={styles.section}>
            <span className={styles.sectionLabel}>Tipo de ação</span>
            <div className={styles.pillRow} role="radiogroup" aria-label="Tipo de ação">
              {builder.actionTypes.map((at) => {
                const Icon = actionTypeIcons[at.id];
                const isActive = activeActionType === at.id;
                return (
                  <button
                    key={at.id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={`${styles.pill} ${isActive ? styles.pillActive : ""}`}
                    onClick={() => setActiveActionType(at.id)}
                  >
                    <Icon size={14} aria-hidden />
                    <span>{at.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className={styles.fieldGrid}>
            {channelField && (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{channelField.label}</span>
                <Controller
                  control={control}
                  name="channel"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      ariaLabel={channelField.label}
                      icon={<Monitor size={14} aria-hidden />}
                    >
                      {CHANNEL_OPTIONS.map((opt) => (
                        <Select.Item key={opt} value={opt}>
                          {opt}
                        </Select.Item>
                      ))}
                    </Select>
                  )}
                />
              </label>
            )}

            {actionField && (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{actionField.label}</span>
                <Controller
                  control={control}
                  name="action"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      ariaLabel={actionField.label}
                    >
                      {ACTION_OPTIONS.map((opt) => (
                        <Select.Item key={opt} value={opt}>
                          {opt}
                        </Select.Item>
                      ))}
                    </Select>
                  )}
                />
              </label>
            )}

            {intensityField && (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  {intensityField.label}
                  <span className={styles.fieldHint}>
                    <Controller
                      control={control}
                      name="intensity"
                      render={({ field }) => <span>{field.value}%</span>}
                    />
                  </span>
                </span>
                <Controller
                  control={control}
                  name="intensity"
                  render={({ field }) => (
                    <Slider
                      min={0}
                      max={100}
                      step={1}
                      marks={intensityField.marks}
                      value={[field.value]}
                      onValueChange={(v) => field.onChange(v[0] ?? 0)}
                    />
                  )}
                />
              </label>
            )}

            {periodField && (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{periodField.label}</span>
                <Controller
                  control={control}
                  name="period"
                  render={({ field }) => (
                    <span className={styles.periodChip}>
                      <Calendar size={14} aria-hidden />
                      <input
                        type="text"
                        value={field.value}
                        onChange={field.onChange}
                        aria-label={periodField.label}
                        className={styles.periodInput}
                      />
                    </span>
                  )}
                />
              </label>
            )}
          </div>

          {advancedField && (
            <details className={styles.advanced}>
              <summary className={styles.advancedSummary}>
                <ChevronDown size={14} aria-hidden className={styles.advancedChevron} />
                {advancedField.label}
              </summary>
              <div className={styles.advancedBody}>
                <p className={styles.advancedNote}>
                  Configurações avançadas serão habilitadas quando a integração
                  com a API de simulação estiver disponível.
                </p>
              </div>
            </details>
          )}

          {Object.keys(errors).length > 0 && (
            <span className={styles.errorText} role="alert">
              Revise os campos do cenário.
            </span>
          )}

          <div className={styles.footerActions}>
            <Button
              type="submit"
              variant="primary"
              iconLeft={primaryIcon ?? <Play size={14} />}
            >
              {builder.primaryAction.label}
            </Button>
          </div>
        </form>
      </Card.Body>
    </Card>
  );
}
