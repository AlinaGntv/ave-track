"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bell, Plus, X } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import { BottomSheet, SheetHeader } from "@/shared/ui/BottomSheet";
import { spring } from "@/shared/ui/motion";
import { Pressable } from "@/shared/ui/Pressable";
import { Segmented } from "@/shared/ui/Segmented";
import { Stepper } from "@/shared/ui/Stepper";
import {
  describeEarly,
  EARLY_PRESETS,
  earlyLabel,
  earlyReminderDate,
  MAX_EARLY_REMINDERS,
  normalizeEarly,
  type EarlyOffset,
  type EarlyUnit,
} from "../early";

const UNITS: Array<{ value: EarlyUnit; label: string }> = [
  { value: "d", label: "Дней" },
  { value: "w", label: "Недель" },
  { value: "m", label: "Месяцев" },
];

/**
 * Ранние напоминания задачи: несколько сразу («за месяц», «за 2 недели», «за неделю»).
 * Монтируется заново на каждое открытие (key), начальное значение — текущее у задачи.
 */
export function EarlyRemindersSheet({
  open,
  value,
  dueDate,
  today,
  onClose,
  onChange,
}: {
  open: boolean;
  value: EarlyOffset[];
  dueDate: string;
  today: string;
  onClose: () => void;
  onChange: (value: EarlyOffset[]) => void;
}) {
  const [selected, setSelected] = useState<EarlyOffset[]>(normalizeEarly(value));
  const [amount, setAmount] = useState(10);
  const [unit, setUnit] = useState<EarlyUnit>("d");
  const full = selected.length >= MAX_EARLY_REMINDERS;

  const toggle = (offset: EarlyOffset) =>
    setSelected((prev) =>
      prev.includes(offset) ? prev.filter((o) => o !== offset) : full ? prev : normalizeEarly([...prev, offset]),
    );
  const addCustom = () => {
    const offset = `${amount}${unit}` as EarlyOffset;
    if (!selected.includes(offset) && !full) setSelected((prev) => normalizeEarly([...prev, offset]));
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="Напоминания заранее"
      header={
        <SheetHeader
          title="Заранее"
          onCancel={onClose}
          onDone={() => {
            onChange(selected);
            onClose();
          }}
        />
      }
    >
      <p className="px-2 pb-3 text-center text-[15px] font-bold" aria-live="polite">
        {selected.length ? `Напомнить ${describeEarly(selected)}` : "Без напоминаний заранее"}
      </p>

      <section className="rounded-[20px] bg-surface p-3">
        <p className="px-1 pb-2.5 text-[13px] font-semibold text-muted-2">Быстрый выбор — можно несколько</p>
        <div className="flex flex-wrap gap-2">
          {EARLY_PRESETS.map((offset) => {
            const active = selected.includes(offset);
            return (
              <Pressable
                key={offset}
                aria-pressed={active}
                onClick={() => toggle(offset)}
                className={cn(
                  "h-10 rounded-full px-4 text-[14px] font-semibold transition-colors",
                  active ? "bg-ink text-on-ink" : "bg-bg text-fg",
                )}
              >
                {earlyLabel(offset).replace(/^за/, "За")}
              </Pressable>
            );
          })}
        </div>
      </section>

      <section className="mt-3 rounded-[20px] bg-surface p-3">
        <p className="px-1 pb-2.5 text-[13px] font-semibold text-muted-2">Своё</p>
        <Segmented<EarlyUnit> label="Единица" value={unit} onChange={setUnit} options={UNITS} />
        <div className="mt-3 flex items-center justify-between gap-3 px-1">
          <Stepper label="Сколько" value={amount} min={1} max={unit === "d" ? 365 : unit === "w" ? 52 : 12} onChange={setAmount} />
          <Pressable
            onClick={addCustom}
            disabled={full}
            className="flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-semibold text-on-ink disabled:opacity-40"
          >
            <Plus size={16} />
            {earlyLabel(`${amount}${unit}`).replace(/^за/, "За")}
          </Pressable>
        </div>
      </section>

      {selected.length > 0 && (
        <section className="mt-3 rounded-[20px] bg-surface px-4 py-2">
          <AnimatePresence initial={false}>
            {selected.map((offset) => {
              const date = earlyReminderDate(dueDate, offset)!;
              const passed = date <= today;
              return (
                <motion.div
                  key={offset}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={spring.smooth}
                  className="flex min-h-12 items-center gap-3 border-b border-line last:border-0"
                >
                  <Bell size={16} className={cn("shrink-0", passed ? "text-muted" : "text-fg")} />
                  <span className={cn("flex-1 text-[15px] font-medium", passed && "text-muted")}>
                    {earlyLabel(offset).replace(/^за/, "За")}
                    <span className="block text-[12px] font-normal text-muted-2">
                      {passed ? "дата уже прошла — не придёт" : formatDate(date, "d MMMM, EEEEEE")}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Убрать «${earlyLabel(offset)}»`}
                    onClick={() => toggle(offset)}
                    className="-mr-2 flex h-11 w-11 items-center justify-center text-muted"
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </section>
      )}

      <p className="px-3 pt-3 text-[12px] text-muted-2">
        Напоминания приходят в Telegram утром, во время утренней сводки. У повторяющейся задачи они
        сами переносятся на её следующую дату.
      </p>
    </BottomSheet>
  );
}
