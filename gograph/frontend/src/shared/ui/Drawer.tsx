import { type ReactNode, type CSSProperties } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "./cn";
import styles from "./Drawer.module.css";

export type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  width?: number;
  children?: ReactNode;
  className?: string;
};

export function Drawer({
  open,
  onOpenChange,
  title,
  width = 400,
  children,
  className,
}: DrawerProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={cn(styles.content, className)}
          style={{ ["--drawer-width" as string]: `${width}px` } as CSSProperties}
          aria-describedby={undefined}
        >
          <header className={styles.header}>
            <RadixDialog.Title className={styles.title}>
              {title ?? ""}
            </RadixDialog.Title>
            <RadixDialog.Close asChild>
              <button
                type="button"
                className={styles.close}
                aria-label="Fechar drawer"
              >
                <X size={16} aria-hidden />
              </button>
            </RadixDialog.Close>
          </header>
          <div className={styles.body}>{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
