import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { type CSSProperties, type ReactNode } from "react";
import { cn } from "./cn";
import styles from "./Modal.module.css";

export type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  className?: string;
};

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 480,
  className,
}: ModalProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={cn(styles.content, className)}
          style={
            { ["--modal-width" as string]: `${width}px` } as CSSProperties
          }
          aria-describedby={undefined}
        >
          <header className={styles.header}>
            <RadixDialog.Title className={styles.title}>
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close asChild>
              <button
                type="button"
                className={styles.close}
                aria-label="Fechar"
              >
                <X size={16} aria-hidden />
              </button>
            </RadixDialog.Close>
          </header>
          {description && (
            <p className={styles.description}>{description}</p>
          )}
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
