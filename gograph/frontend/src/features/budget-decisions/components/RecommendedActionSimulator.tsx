import { useState } from "react";
import { Slider, Badge } from "../../../shared/ui";
import type { DrawerSuggestedAction } from "../types";
import styles from "./RecommendedActionSimulator.module.css";

export type RecommendedActionSimulatorProps = {
  action: DrawerSuggestedAction;
};

// The contract exposes 4 discrete steps: min, current, selected, max.
// We render the slider with those 4 marks and a default thumb at the
// `selected` step (index 2 in the array).
export function RecommendedActionSimulator({
  action,
}: RecommendedActionSimulatorProps) {
  const marks = [
    action.slider.min,
    action.slider.current,
    action.slider.selected,
    action.slider.max,
  ];
  const defaultIndex = 2;
  const [step, setStep] = useState<number>(defaultIndex);

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <h3 className={styles.title}>{action.title}</h3>
        <p className={styles.description}>{action.description}</p>
      </div>
      <Slider
        min={0}
        max={marks.length - 1}
        step={1}
        value={[step]}
        onValueChange={(v) => setStep(v[0] ?? 0)}
        marks={marks}
        aria-label="Ajuste de investimento"
      />
      <div className={styles.impact}>
        <span className={styles.impactLabel}>Impacto estimado:</span>
        <Badge tone="green" variant="soft" size="sm">
          Receita {action.estimatedImpact.revenue}
        </Badge>
        <Badge tone="cyan" variant="soft" size="sm">
          ROAS {action.estimatedImpact.roas}
        </Badge>
      </div>
    </div>
  );
}
