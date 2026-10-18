"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { spring } from "./motion";

type ToastOptions = {
  message: string;
  action?: { label: string; onClick: () => void };
  durationMs?: number;
  /** Тост закрылся без нажатия на action (по таймеру или его вытеснил другой тост) */
  onDismiss?: () => void;
};

type ToastApi = { show: (toast: ToastOptions) => void; hide: () => void };

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast вне ToastProvider");
  return ctx;
}

/** Один тост за раз над таб-баром — для «Отменить» после выполнения/удаления. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seq = useRef(0);

  // onDismiss текущего тоста; обнуляется, если пользователь нажал action
  const pendingDismiss = useRef<(() => void) | undefined>(undefined);
  const flushDismiss = () => {
    const fn = pendingDismiss.current;
    pendingDismiss.current = undefined;
    fn?.();
  };

  const hide = useCallback(() => {
    flushDismiss();
    setToast(null);
  }, []);
  const show = useCallback((options: ToastOptions) => {
    flushDismiss();
    pendingDismiss.current = options.onDismiss;
    seq.current += 1;
    setToast({ ...options, id: seq.current });
  }, []);

  // Уход со страницы/закрытие приложения — фиксируем отложенное действие
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flushDismiss();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (toast) timer.current = setTimeout(hide, toast.durationMs ?? 4000);
    return () => clearTimeout(timer.current);
  }, [toast, hide]);

  const api = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(92px+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md justify-center px-4">
        <AnimatePresence mode="popLayout">
          {toast && (
            <motion.div
              key={toast.id}
              role="status"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={spring.smooth}
              className="pointer-events-auto flex min-h-12 w-full items-center gap-3 rounded-[18px] bg-ink py-1.5 pr-1.5 pl-5 text-on-ink shadow-soft"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{toast.message}</span>
              {toast.action && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => {
                    pendingDismiss.current = undefined;
                    toast.action!.onClick();
                    hide();
                  }}
                  className="h-11 shrink-0 rounded-[14px] px-4 text-sm font-bold"
                >
                  {toast.action.label}
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
