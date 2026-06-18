import { useEffect, type ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import {
  Button,
  Modal,
  Select,
  Slider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useToast,
} from "../../shared/ui";
import { api, type ModelRunCreatePayload } from "../../lib/api";
import { useModelDefaults } from "../../features/settings/useModelDefaults";
import styles from "./NewRunDialog.module.css";

function FieldLabel({
  label,
  hint,
  trailing,
}: {
  label: string;
  hint: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <span className={styles.label}>
      <span className={styles.labelText}>
        {label}
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>
            <button type="button" className={styles.infoBtn} aria-label={`Sobre ${label}`}>
              <Info size={13} aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className={styles.tooltip}>
            {hint}
          </TooltipContent>
        </Tooltip>
      </span>
      {trailing}
    </span>
  );
}

export type NewRunDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  /**
   * Optional defaults used when "Reexecutar" is invoked — pre-fills the form
   * with parameters from the selected run.
   */
  defaults?: Partial<ModelRunCreatePayload>;
};

const schema = z.object({
  start_date: z.string().min(1, "Obrigatório"),
  end_date: z.string().min(1, "Obrigatório"),
  lookback_days: z
    .number()
    .int()
    .min(0)
    .max(365)
    .nullable(),
  decay_lambda: z.number().min(0).max(1),
  non_conv_sample_pct: z.number().min(0).max(100),
  non_conv_scale: z.number().nullable(),
  shapley_samples: z.number().int().min(100).max(50_000),
  db_plausible: z.number().int().min(0),
  db_datamart: z.number().int().min(0).nullable(),
  batch_mode: z.enum(["auto", "always", "never"]),
  batch_days: z.number().int().min(1).max(365),
});

type SchemaValues = z.infer<typeof schema>;

const DEFAULTS: SchemaValues = {
  start_date: "2026-03-01",
  end_date: "2026-03-31",
  lookback_days: 30,
  decay_lambda: 0.05,
  non_conv_sample_pct: 1,
  non_conv_scale: null,
  shapley_samples: 5000,
  db_plausible: 70,
  db_datamart: 63,
  batch_mode: "auto",
  batch_days: 35,
};

function mergeDefaults(d?: Partial<ModelRunCreatePayload>): SchemaValues {
  if (!d) return DEFAULTS;
  return {
    start_date: d.start_date ?? DEFAULTS.start_date,
    end_date: d.end_date ?? DEFAULTS.end_date,
    lookback_days:
      d.lookback_days === undefined ? DEFAULTS.lookback_days : d.lookback_days,
    decay_lambda: d.decay_lambda ?? DEFAULTS.decay_lambda,
    non_conv_sample_pct:
      d.non_conv_sample_pct ?? DEFAULTS.non_conv_sample_pct,
    non_conv_scale:
      d.non_conv_scale === undefined ? DEFAULTS.non_conv_scale : d.non_conv_scale,
    shapley_samples: d.shapley_samples ?? DEFAULTS.shapley_samples,
    db_plausible: d.db_plausible ?? DEFAULTS.db_plausible,
    db_datamart:
      d.db_datamart === undefined ? DEFAULTS.db_datamart : d.db_datamart,
    batch_mode: d.batch_mode ?? DEFAULTS.batch_mode,
    batch_days: d.batch_days ?? DEFAULTS.batch_days,
  };
}

export function NewRunDialog({
  open,
  onOpenChange,
  title = "Nova execução",
  description = "Defina o período e os parâmetros do modelo Markov.",
  submitLabel = "Criar execução",
  defaults,
}: NewRunDialogProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { asRunPayload } = useModelDefaults();
  // When no explicit defaults prop is passed (i.e. user clicked "Nova execução"
  // from a generic button), seed the form with the values configured in
  // Configurações instead of the hard-coded constants.
  const effectiveDefaults: Partial<ModelRunCreatePayload> | undefined =
    defaults ?? asRunPayload();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SchemaValues>({
    resolver: zodResolver(schema),
    defaultValues: mergeDefaults(effectiveDefaults),
  });

  useEffect(() => {
    if (open) {
      reset(mergeDefaults(effectiveDefaults));
    }
    // We intentionally exclude effectiveDefaults from deps — reset on open is enough
    // and re-running on every render of useModelDefaults() would clobber edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaults, reset]);

  const mutation = useMutation({
    mutationFn: (payload: ModelRunCreatePayload) => api.createRun(payload),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      toast.push(`Execução criada (id: ${run.id})`, "green");
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Falha ao criar execução";
      toast.push(message, "red");
    },
  });

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(values satisfies ModelRunCreatePayload);
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      width={560}
      footer={
        <>
          <Button
            variant="secondary"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting || mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="new-run-form"
            loading={isSubmitting || mutation.isPending}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id="new-run-form"
        onSubmit={onSubmit}
        className={styles.form}
        aria-label="Nova execução"
      >
        <div className={styles.row2}>
          <label className={styles.field}>
            <FieldLabel
              label="Data inicial"
              hint="Primeiro dia do período analisado. As compras consideradas têm purchase_date >= esta data."
            />
            <input
              type="date"
              {...register("start_date")}
              className={styles.input}
            />
            {errors.start_date && (
              <span className={styles.error} role="alert">
                {errors.start_date.message}
              </span>
            )}
          </label>
          <label className={styles.field}>
            <FieldLabel
              label="Data final"
              hint="Último dia do período analisado. Compras com purchase_date <= esta data entram no modelo."
            />
            <input
              type="date"
              {...register("end_date")}
              className={styles.input}
            />
            {errors.end_date && (
              <span className={styles.error} role="alert">
                {errors.end_date.message}
              </span>
            )}
          </label>
        </div>

        <div className={styles.row2}>
          <label className={styles.field}>
            <FieldLabel
              label="Lookback (dias)"
              hint={
                <>
                  Janela retroativa para reconstruir a jornada. Cada conversão considera as sessões
                  do usuário nos últimos N dias antes da compra.
                  <br /><br />
                  <strong>Maior</strong> = jornadas mais completas, mais memória, mais custo.
                  <strong> Menor</strong> = visão de curto prazo, sub-atribui canais de topo de funil.
                </>
              }
            />
            <input
              type="number"
              min={0}
              max={365}
              {...register("lookback_days", {
                setValueAs: (v) => (v === "" ? null : Number(v)),
              })}
              className={styles.input}
            />
          </label>
          <Controller
            control={control}
            name="batch_mode"
            render={({ field }) => (
              <label className={styles.field}>
                <FieldLabel
                  label="Modo de lote"
                  hint={
                    <>
                      Quebra a extração de transições em pedaços para evitar OOM no ClickHouse.
                      <br /><br />
                      <strong>auto</strong> = quebra quando o período {">"} Dias por lote.<br />
                      <strong>always</strong> = sempre quebra (debug).<br />
                      <strong>never</strong> = uma query só (rápido em períodos pequenos).
                    </>
                  }
                />
                <Select
                  value={field.value}
                  onValueChange={(v) =>
                    field.onChange(v as SchemaValues["batch_mode"])
                  }
                  ariaLabel="Modo de lote"
                >
                  <Select.Item value="auto">auto</Select.Item>
                  <Select.Item value="always">always</Select.Item>
                  <Select.Item value="never">never</Select.Item>
                </Select>
              </label>
            )}
          />
        </div>

        <div className={styles.row2}>
          <label className={styles.field}>
            <FieldLabel
              label="Dias por lote"
              hint="Tamanho de cada batch da extração quando o modo de lote dispara. 30 a 60 dias é o sweet spot para datasets do ClickHouse."
            />
            <input
              type="number"
              min={1}
              max={365}
              {...register("batch_days", { valueAsNumber: true })}
              className={styles.input}
            />
          </label>
          <label className={styles.field}>
            <FieldLabel
              label="Shapley samples"
              hint={
                <>
                  Quantidade de coalizões amostradas pelo Monte Carlo do Shapley.
                  <br /><br />
                  <strong>1.000</strong>: rápido, ruidoso. <strong>5.000</strong>: padrão equilibrado.{" "}
                  <strong>20.000+</strong>: estável, lento. Erro cai com ~1/√N.
                </>
              }
            />
            <input
              type="number"
              min={100}
              max={50_000}
              step={100}
              {...register("shapley_samples", { valueAsNumber: true })}
              className={styles.input}
            />
          </label>
        </div>

        <Controller
          control={control}
          name="decay_lambda"
          render={({ field }) => (
            <label className={styles.field}>
              <FieldLabel
                label="Decay λ"
                trailing={<span className={styles.hint}>{field.value.toFixed(2)}</span>}
                hint={
                  <>
                    Decaimento exponencial do peso das transições conforme a sessão fica mais antiga
                    em relação à conversão. Peso = e^(−λ · dias).
                    <br /><br />
                    <strong>0,00</strong> = sem decay (todas as sessões pesam igual).<br />
                    <strong>0,05</strong> = ~50% de peso após 14 dias (padrão).<br />
                    <strong>0,15</strong> = ~50% após 4,6 dias (privilegia toques recentes).
                  </>
                }
              />
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[field.value]}
                onValueChange={(v) => field.onChange(v[0] ?? 0)}
              />
            </label>
          )}
        />

        <div className={styles.row2}>
          <label className={styles.field}>
            <FieldLabel
              label="Non-conv sample %"
              hint={
                <>
                  Fração dos usuários sem conversão amostrada para o modelo.
                  <br /><br />
                  Em datasets grandes (milhões de não-conversores) usamos 1–5% para manter o cálculo tratável;
                  o peso é recalibrado depois pelo <em>Non-conv scale</em>.
                </>
              }
            />
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              {...register("non_conv_sample_pct", { valueAsNumber: true })}
              className={styles.input}
            />
          </label>
          <label className={styles.field}>
            <FieldLabel
              label="Non-conv scale"
              hint={
                <>
                  Reescala os não-conversores amostrados para representar o universo real.
                  <br /><br />
                  <strong>Vazio</strong> = autocalibra para bater a taxa observada (recomendado).<br />
                  <strong>1</strong> = sem reescala. <strong>100</strong> = simula 100× mais não-conversores.
                </>
              }
            />
            <input
              type="number"
              min={0}
              {...register("non_conv_scale", {
                setValueAs: (v) => (v === "" ? null : Number(v)),
              })}
              className={styles.input}
            />
          </label>
        </div>

        <div className={styles.row2}>
          <label className={styles.field}>
            <FieldLabel
              label="DB Plausible"
              hint="ID do banco Plausible (ClickHouse) no Metabase. As sessões UTM e jornadas vêm daqui. Padrão: 70."
            />
            <input
              type="number"
              min={0}
              {...register("db_plausible", { valueAsNumber: true })}
              className={styles.input}
            />
          </label>
          <label className={styles.field}>
            <FieldLabel
              label="DB Datamart"
              hint="ID do banco Data Mart no Metabase (spend de Google Ads, Meta, etc.). Necessário para calcular ROAS. Padrão: 63."
            />
            <input
              type="number"
              min={0}
              {...register("db_datamart", {
                setValueAs: (v) => (v === "" ? null : Number(v)),
              })}
              className={styles.input}
            />
          </label>
        </div>
      </form>
    </Modal>
  );
}
