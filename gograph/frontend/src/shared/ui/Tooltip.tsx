import { type ComponentProps, forwardRef } from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import { cn } from "./cn";
import styles from "./Tooltip.module.css";

export const TooltipProvider = RadixTooltip.Provider;
export const Tooltip = RadixTooltip.Root;
export const TooltipTrigger = RadixTooltip.Trigger;

export const TooltipContent = forwardRef<
  HTMLDivElement,
  ComponentProps<typeof RadixTooltip.Content>
>(function TooltipContent({ className, sideOffset = 6, children, ...rest }, ref) {
  return (
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(styles.content, className)}
        {...rest}
      >
        {children}
        <RadixTooltip.Arrow className={styles.arrow} />
      </RadixTooltip.Content>
    </RadixTooltip.Portal>
  );
});
