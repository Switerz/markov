import { type ReactNode, type ComponentProps, forwardRef } from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "./cn";
import styles from "./Select.module.css";

export type SelectProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  disabled?: boolean;
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
};

const SelectRoot = ({
  value,
  defaultValue,
  onValueChange,
  placeholder,
  icon,
  disabled,
  children,
  ariaLabel,
  className,
}: SelectProps) => (
  <RadixSelect.Root
    value={value}
    defaultValue={defaultValue}
    onValueChange={onValueChange}
    disabled={disabled}
  >
    <RadixSelect.Trigger
      aria-label={ariaLabel}
      className={cn(styles.trigger, className)}
    >
      {icon && (
        <span className={styles.icon} aria-hidden>
          {icon}
        </span>
      )}
      <RadixSelect.Value placeholder={placeholder} />
      <RadixSelect.Icon className={styles.chevron}>
        <ChevronDown size={14} />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
    <RadixSelect.Portal>
      <RadixSelect.Content className={styles.content} position="popper" sideOffset={6}>
        <RadixSelect.Viewport className={styles.viewport}>{children}</RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  </RadixSelect.Root>
);

const SelectItem = forwardRef<
  HTMLDivElement,
  ComponentProps<typeof RadixSelect.Item>
>(function SelectItem({ className, children, ...rest }, ref) {
  return (
    <RadixSelect.Item ref={ref} className={cn(styles.item, className)} {...rest}>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className={styles.indicator}>
        <Check size={14} />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
});

export const Select = Object.assign(SelectRoot, { Item: SelectItem });
