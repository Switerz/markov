import { forwardRef, type ComponentProps } from "react";
import * as RadixSlider from "@radix-ui/react-slider";
import { cn } from "./cn";
import styles from "./Slider.module.css";

export type SliderProps = ComponentProps<typeof RadixSlider.Root> & {
  marks?: string[];
};

export const Slider = forwardRef<HTMLSpanElement, SliderProps>(function Slider(
  { className, marks, value, defaultValue, ...rest },
  ref,
) {
  const thumbs = value ?? defaultValue ?? [0];
  return (
    <div className={cn(styles.wrap, className)}>
      <RadixSlider.Root
        ref={ref}
        className={styles.root}
        value={value}
        defaultValue={defaultValue}
        {...rest}
      >
        <RadixSlider.Track className={styles.track}>
          <RadixSlider.Range className={styles.range} />
        </RadixSlider.Track>
        {thumbs.map((_, i) => (
          <RadixSlider.Thumb key={i} className={styles.thumb} aria-label={`Valor ${i + 1}`} />
        ))}
      </RadixSlider.Root>
      {marks && marks.length > 0 && (
        <div className={styles.marks} aria-hidden>
          {marks.map((m, i) => (
            <span key={i} className={styles.mark}>{m}</span>
          ))}
        </div>
      )}
    </div>
  );
});
