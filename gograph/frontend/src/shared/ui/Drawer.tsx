import { type ReactNode, type CSSProperties } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "./cn";
import styles from "./Drawer.module.css";

export type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modal?: boolean;
  showOverlay?: boolean;
  dismissOnInteractOutside?: boolean;
  /**
   * Heading for the drawer. Accepts a plain string OR a ReactNode so callers
   * can compose richer headers (icon + name + badge) without losing the
   * Radix `<Dialog.Title>` accessibility wiring.
   */
  title?: ReactNode;
  width?: number;
  children?: ReactNode;
  className?: string;
};

export function Drawer({
  open,
  onOpenChange,
  modal = true,
  showOverlay = true,
  dismissOnInteractOutside = true,
  title,
  width = 400,
  children,
  className,
}: DrawerProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <RadixDialog.Portal>
        {showOverlay && <RadixDialog.Overlay className={styles.overlay} />}
        <RadixDialog.Content
          className={cn(styles.content, className)}
          style={{ ["--drawer-width" as string]: `${width}px` } as CSSProperties}
          aria-describedby={undefined}
          onInteractOutside={
            dismissOnInteractOutside
              ? undefined
              : (event) => event.preventDefault()
          }
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
