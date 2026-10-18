"use client";

import { getDate, getISODay, parseISO } from "date-fns";
import { useState, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { shiftDate } from "@/shared/lib/dates";
import { BottomSheet, SheetHeader } from "@/shared/ui/BottomSheet";
import { Pressable } from "@/shared/ui/Pressable";
import { Segmented } from "@/shared/ui/Segmented";
import { Stepper } from "@/shared/ui/Stepper";
import { describeRecurrence, NTH_LABELS, plural, UNIT_FORMS, WEEKDAY_NAMES, WEEKDAY_SHORT } from "../describe";
import { defaultRecurrence, normalizeRecurrence, type Frequency, type Recurrence } from "../rule";

type FreqOption = Frequency | "none";

const FREQ_OPTIONS: Array<{ value: FreqOption; label: string }> = [
  { value: "none", label: "Нет" },
  { value: "day", label: "День" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "year", label: "Год" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-3 rounded-[20px] bg-surface p-3">
      <p className="px-1 pb-2.5 text-[13px] font-semibold text-muted-2">{title}</p>
      {children}
    </section>
  );
}

const selectClass =
  "h-11 min-w-0 flex-1 appearance-none rounded-[14px] bg-bg px-4 text-base font-semibold outline-none";

/**
 * Настройка повтора: частота, интервал, дни недели / правило месяца, окончание.
 * Монтируется заново при каждом открытии (key), начальное значение — текущее правило задачи.
 */
export function RecurrenceSheet({
  open,
  value,
  dueDate,
  onClose,
  onChange,
}: {
  open: boolean;
  value: Recurrence | null;
  /** Дата задачи — якорь для значений по умолчанию */
  dueDate: string;
  onClose: () => void;
  onChange: (rule: Recurrence | null) => void;
}) {
  const [rule, setRule] = useState<Recurrence | null>(value);
  const patch = (p: Partial<Recurrence>) => setRule((r) => (r ? { ...r, ...p } : r));

  const setFreq = (freq: FreqOption) =>
    setRule(freq === "none" ? null : { ...defaultRecurrence(freq, dueDate), end: rule?.end ?? { type: "never" } });

  const toggleWeekday = (day: number) => {
    if (!rule) return;
    const current = rule.weekdays ?? [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    // Хотя бы один день должен остаться выбранным
    if (next.length > 0) patch({ weekdays: next.sort((a, b) => a - b) });
  };

  const due = parseISO(dueDate);
  const monthly = rule?.monthly ?? { type: "day" as const, day: getDate(due) };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="Повтор"
      header={
        <SheetHeader
          title="Повтор"
          onCancel={onClose}
          onDone={() => {
            onChange(rule ? normalizeRecurrence(rule) : null);
            onClose();
          }}
        />
      }
    >
      <p className="px-2 pb-3 text-center text-[15px] font-bold" aria-live="polite">
        {rule ? describeRecurrence(rule) : "Не повторять"}
      </p>

      <Segmented<FreqOption> label="Частота" options={FREQ_OPTIONS} value={rule?.freq ?? "none"} onChange={setFreq} />

      {rule && (
        <>
          <Section title="Интервал">
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-[15px] font-medium">
                Раз в {rule.interval} {plural(rule.interval, UNIT_FORMS[rule.freq])}
              </span>
              <Stepper label="Интервал" value={rule.interval} onChange={(interval) => patch({ interval })} />
            </div>
          </Section>

          {rule.freq === "week" && (
            <Section title="Дни недели">
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_SHORT.map((label, i) => {
                  const day = i + 1;
                  const active = rule.weekdays?.includes(day) ?? false;
                  return (
                    <Pressable
                      key={label}
                      aria-label={WEEKDAY_NAMES[i]}
                      aria-pressed={active}
                      onClick={() => toggleWeekday(day)}
                      className={cn(
                        "flex aspect-square min-h-11 items-center justify-center rounded-full text-[13px] font-bold transition-colors",
                        active ? "bg-ink text-on-ink" : "bg-bg text-fg",
                      )}
                    >
                      {label}
                    </Pressable>
                  );
                })}
              </div>
            </Section>
          )}

          {rule.freq === "month" && (
            <Section title="Когда">
              <Segmented<"day" | "nth">
                label="Тип ежемесячного повтора"
                value={monthly.type}
                onChange={(type) =>
                  patch({
                    monthly:
                      type === "day"
                        ? { type: "day", day: getDate(due) }
                        : { type: "nth", nth: Math.min(4, Math.ceil(getDate(due) / 7)) as 1 | 2 | 3 | 4, weekday: getISODay(due) },
                  })
                }
                options={[
                  { value: "day", label: "По числу" },
                  { value: "nth", label: "По дню недели" },
                ]}
              />
              {monthly.type === "day" ? (
                <div className="mt-3 grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <Pressable
                      key={day}
                      aria-pressed={monthly.day === day}
                      onClick={() => patch({ monthly: { type: "day", day } })}
                      className={cn(
                        "flex aspect-square min-h-10 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums transition-colors",
                        monthly.day === day ? "bg-ink text-on-ink" : "text-fg",
                      )}
                    >
                      {day}
                    </Pressable>
                  ))}
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <select
                    aria-label="Какой по счёту"
                    value={monthly.nth}
                    onChange={(e) =>
                      patch({ monthly: { ...monthly, nth: Number(e.target.value) as 1 | 2 | 3 | 4 | -1 } })
                    }
                    className={selectClass}
                  >
                    {NTH_LABELS.map((n) => (
                      <option key={n.value} value={n.value}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="День недели"
                    value={monthly.weekday}
                    onChange={(e) => patch({ monthly: { ...monthly, weekday: Number(e.target.value) } })}
                    className={selectClass}
                  >
                    {WEEKDAY_NAMES.map((name, i) => (
                      <option key={name} value={i + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {monthly.type === "day" && monthly.day > 28 && (
                <p className="px-1 pt-2 text-[12px] text-muted-2">
                  В коротких месяцах — в последний день месяца
                </p>
              )}
            </Section>
          )}

          <Section title="Окончание">
            <Segmented<Recurrence["end"]["type"]>
              label="Окончание"
              value={rule.end.type}
              onChange={(type) =>
                patch({
                  end:
                    type === "never"
                      ? { type }
                      : type === "until"
                        ? { type, date: shiftDate(dueDate, 30) }
                        : { type, count: 10 },
                })
              }
              options={[
                { value: "never", label: "Никогда" },
                { value: "until", label: "До даты" },
                { value: "count", label: "Кол-во раз" },
              ]}
            />
            {rule.end.type === "until" && (
              <input
                type="date"
                value={rule.end.date}
                min={dueDate}
                onChange={(e) => e.target.value && patch({ end: { type: "until", date: e.target.value } })}
                aria-label="Повторять до"
                className="mt-3 h-11 w-full rounded-[14px] bg-bg px-4 font-semibold outline-none"
              />
            )}
            {rule.end.type === "count" && (
              <div className="mt-3 flex items-center justify-between gap-3 px-1">
                <span className="text-[15px] font-medium">
                  {rule.end.count} {plural(rule.end.count, ["раз", "раза", "раз"])}
                </span>
                <Stepper
                  label="Количество повторений"
                  value={rule.end.count}
                  max={9999}
                  onChange={(count) => patch({ end: { type: "count", count } })}
                />
              </div>
            )}
          </Section>
        </>
      )}
    </BottomSheet>
  );
}
