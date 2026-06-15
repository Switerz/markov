import { forwardRef, type ComponentProps } from "react";
import * as RadixSwitch from "@radix-ui/react-switch";
import { cn } from "./cn";
import styles from "./Switch.module.css";

export type SwitchProps = ComponentProps<typeof RadixSwitch.Root>;

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { className, ...rest },
  ref,
) {
  return (
    <RadixSwitch.Root ref={ref} className={cn(styles.root, className)} {...rest}>
      <RadixSwitch.Thumb className={styles.thumb} />
    </RadixSwitch.Root>
  );
});
