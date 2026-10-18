"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { haptic } from "@/shared/lib/haptics";
import { cn } from "@/shared/lib/cn";
import { spring } from "@/shared/ui/motion";
import { useToast } from "@/shared/ui/Toast";
import { sendReportAction } from "../actions";

type State = "idle" | "sending" | "sent";

const LABELS: Record<State, string> = {
  idle: "В Telegram",
  sending: "Отправляю…",
  sent: "Отправлено",
};

/** Кнопка «отчёт в Telegram»: задачи на сегодня и доходы за месяц одним нажатием. */
export function SendReportButton() {
  const [state, setState] = useState<State>("idle");
  const toast = useToast();

  // Через пару секунд после успеха кнопка возвращается в обычный вид
  useEffect(() => {
    if (state !== "sent") return;
    const timer = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(timer);
  }, [state]);

  const send = async () => {
    if (state !== "idle") return;
    setState("sending");
    const result = await sendReportAction();
    if (result.ok) {
      haptic(12);
      setState("sent");
      toast.show({ message: "Отчёт отправлен — загляните в Telegram" });
    } else {
      setState("idle");
      toast.show({ message: `Не отправилось: ${result.error}`, durationMs: 6000 });
    }
  };

  return (
    <motion.button
      type="button"
      onClick={send}
      disabled={state === "sending"}
      aria-live="polite"
      aria-label="Отправить отчёт за сегодня в Telegram"
      whileTap={state === "idle" ? { scale: 0.94 } : undefined}
      transition={spring.snappy}
      // Видимая «таблетка» 36px, зона касания — 44px
      className="-my-1 flex h-11 shrink-0 items-center"
    >
      <motion.span
        layout
        transition={spring.smooth}
        className={cn(
          "flex h-9 items-center gap-1.5 overflow-hidden rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-300",
          state === "sent" ? "bg-ink text-on-ink" : "bg-surface text-fg",
        )}
      >
        <span className="relative flex h-4 w-4 items-center justify-center">
          <AnimatePresence mode="popLayout" initial={false}>
            {state === "sent" ? (
              <motion.span
                key="check"
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={spring.snappy}
              >
                <Check size={15} strokeWidth={2.8} />
              </motion.span>
            ) : (
              <motion.span
                key="plane"
                initial={{ x: -10, y: 10, opacity: 0 }}
                // Во время отправки самолётик «улетает» вверх-вправо и возвращается
                animate={
                  state === "sending"
                    ? { x: [0, 14, -14, 0], y: [0, -14, 14, 0], opacity: [1, 0, 0, 1] }
                    : { x: 0, y: 0, opacity: 1 }
                }
                exit={{ x: 14, y: -14, opacity: 0 }}
                transition={
                  state === "sending"
                    ? { duration: 1.1, repeat: Infinity, ease: "easeInOut", times: [0, 0.45, 0.46, 1] }
                    : spring.snappy
                }
              >
                <Send size={14} strokeWidth={2.2} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={state}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="whitespace-nowrap"
          >
            {LABELS[state]}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </motion.button>
  );
}
