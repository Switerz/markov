import { useState, type ChangeEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Calendar } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "./cn";
import styles from "./DateRangePicker.module.css";

export type DateRange = { from: Date | null; to: Date | null };

export type DateRangePickerProps = {
  value: DateRange;
  onChange: (value: DateRange) => void;
  label?: string;
  className?: string;
};

const DATE_FORMAT = "dd/MM/yyyy";

function formatDate(d: Date | null): string {
  if (!d) return "";
  return format(d, DATE_FORMAT, { locale: ptBR });
}

function parseDate(raw: string): Date | null {
  if (!raw.trim()) return null;
  const parsed = parse(raw, DATE_FORMAT, new Date(), { locale: ptBR });
  return isValid(parsed) ? parsed : null;
}

export function DateRangePicker({
  value,
  onChange,
  label,
  className,
}: DateRangePickerProps) {
  const [fromText, setFromText] = useState(formatDate(value.from));
  const [toText, setToText] = useState(formatDate(value.to));

  const summary = (() => {
    const f = value.from ? formatDate(value.from) : "—";
    const t = value.to ? formatDate(value.to) : "—";
    return `${f} → ${t}`;
  })();

  const handleFromBlur = (e: ChangeEvent<HTMLInputElement>) => {
    const next = parseDate(e.target.value);
    onChange({ ...value, from: next });
  };
  const handleToBlur = (e: ChangeEvent<HTMLInputElement>) => {
    const next = parseDate(e.target.value);
    onChange({ ...value, to: next });
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(styles.trigger, className)}
          aria-label={label ?? "Selecionar intervalo de datas"}
        >
          <Calendar size={14} aria-hidden className={styles.icon} />
          <span className={styles.label}>{label ?? "Período"}</span>
          <span className={styles.summary}>{summary}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.content} align="start" sideOffset={6}>
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>De</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                value={fromText}
                onChange={(e) => setFromText(e.target.value)}
                onBlur={handleFromBlur}
                className={styles.input}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Até</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                value={toText}
                onChange={(e) => setToText(e.target.value)}
                onBlur={handleToBlur}
                className={styles.input}
              />
            </label>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
