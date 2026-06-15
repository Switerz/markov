import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { cn } from "./cn";
import type { Tone } from "../tokens/tokens";
import styles from "./Toast.module.css";

type ToastItem = { id: number; message: string; tone: Tone };

type ToastContextValue = {
  push: (message: string, tone?: Tone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: Tone = "blue") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className={styles.stack} role="region" aria-label="Notificações">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(styles.toast, styles[`tone_${t.tone}`])}
            role="status"
          >
            <span
              className={cn(styles.dot, styles[`dot_${t.tone}`])}
              aria-hidden
            />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
