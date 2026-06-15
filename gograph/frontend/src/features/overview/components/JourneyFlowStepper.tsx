import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import type { JourneyFlowStep } from "../types";
import styles from "./JourneyFlowStepper.module.css";

export type JourneyFlowStepperProps = { steps: JourneyFlowStep[] };

export function JourneyFlowStepper({ steps }: JourneyFlowStepperProps) {
  return (
    <ol className={styles.root} aria-label="Fluxo da jornada">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <Fragment key={step.stage}>
            <li className={`${styles.step} ${isLast ? styles.step_green : ""}`}>
              <span className={styles.stage}>{step.stage}</span>
              <span className={styles.value}>{step.value}</span>
              {step.amount && (
                <span className={styles.amount}>R$ {step.amount}</span>
              )}
            </li>
            {!isLast && (
              <ChevronRight
                className={styles.sep}
                size={16}
                aria-hidden
              />
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}
