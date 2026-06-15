import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Modal,
  Select,
  Slider,
  useToast,
} from "../../shared/ui";
import { api, type ModelRunCreatePayload } from "../../lib/api";
import styles from "./NewRunDialog.module.css";

export type NewRunDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  defaults,
}: NewRunDialogProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SchemaValues>({
    resolver: zodResolver(schema),
    defaultValues: mergeDefaults(defaults),
  });

  useEffect(() => {
    if (open) {
      reset(mergeDefaults(defaults));
    }
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
      title="Nova execução"
      description="Defina o período e os parâmetros do modelo Markov."
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
            Criar execução
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
            <span className={styles.label}>Data inicial</span>
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
            <span className={styles.label}>Data final</span>
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
            <span className={styles.label}>Lookback (dias)</span>
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
                <span className={styles.label}>Modo de lote</span>
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
            <span className={styles.label}>Dias por lote</span>
            <input
              type="number"
              min={1}
              max={365}
              {...register("batch_days", { valueAsNumber: true })}
              className={styles.input}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Shapley samples</span>
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
              <span className={styles.label}>
                Decay λ
                <span className={styles.hint}>{field.value.toFixed(2)}</span>
              </span>
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
            <span className={styles.label}>Non-conv sample %</span>
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
            <span className={styles.label}>Non-conv scale</span>
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
            <span className={styles.label}>DB Plausible</span>
            <input
              type="number"
              min={0}
              {...register("db_plausible", { valueAsNumber: true })}
              className={styles.input}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>DB Datamart</span>
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
