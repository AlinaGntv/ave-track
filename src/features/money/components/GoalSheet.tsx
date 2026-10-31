"use client";

import { addMonths, differenceInCalendarDays, endOfMonth, format, parseISO } from "date-fns";
import { CalendarRange, ChevronsUpDown, Trash2 } from "lucide-react";
import { useState } from "react";
import { shiftDate } from "@/shared/lib/dates";
import { currencySymbol } from "@/shared/lib/money";
import { cn } from "@/shared/lib/cn";
import { BottomSheet, SheetHeader } from "@/shared/ui/BottomSheet";
import { Pressable } from "@/shared/ui/Pressable";
import { Segmented } from "@/shared/ui/Segmented";
import { Switch } from "@/shared/ui/Switch";
import {
  centsToInput,
  goalMonth,
  monthLabel,
  monthOptions,
  monthRange,
  parseAmount,
  type GoalItem,
  type GoalPeriod,
} from "../model";
import type { GoalInput } from "../server";

/** На конкретный месяц · регулярная (каждый месяц/год) · свой срок */
type Mode = "single" | "repeat" | "custom";

const fieldClass = "h-11 rounded-[14px] bg-bg px-3 text-base font-semibold outline-none";

/** Месяц по умолчанию для новой цели: текущий, а в последние дни месяца — уже следующий. */
function defaultMonth(today: string): string {
  const d = parseISO(today);
  const daysLeft = differenceInCalendarDays(endOfMonth(d), d);
  return format(daysLeft <= 4 ? addMonths(d, 1) : d, "yyyy-MM");
}

/** Создание/редактирование денежной цели. Монтируется заново на каждое открытие (key). */
export function GoalSheet({
  open,
  goal,
  today,
  currency,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  goal?: GoalItem;
  today: string;
  currency: string;
  onClose: () => void;
  onSave: (input: GoalInput) => void;
  onDelete?: () => void;
}) {
  const existingMonth = goal ? goalMonth(goal) : null;
  const [mode, setMode] = useState<Mode>(
    !goal ? "single" : goal.period ? "repeat" : existingMonth ? "single" : "custom",
  );
  const [repeat, setRepeat] = useState<GoalPeriod>(goal?.period ?? "month");
  const [month, setMonth] = useState(existingMonth ?? defaultMonth(today));
  const [title, setTitle] = useState(goal?.title ?? "");
  // Пока пользователь не задал своё название, у цели «на месяц» оно следует за выбранным месяцем
  const [titleTouched, setTitleTouched] = useState(
    goal != null && !(existingMonth && goal.title === monthLabel(existingMonth, today)),
  );
  const [amount, setAmount] = useState(goal ? centsToInput(goal.targetCents) : "");
  const [startDate, setStartDate] = useState(goal?.startDate ?? today);
  const [endDate, setEndDate] = useState<string | null>(goal?.endDate ?? null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const autoTitle = mode === "single" ? monthLabel(month, today) : "";
  const shownTitle = mode === "single" && !titleTouched ? autoTitle : title;
  const cents = parseAmount(amount);
  const valid =
    (shownTitle.trim().length > 0 || mode === "single") &&
    cents != null &&
    (mode !== "custom" || !endDate || endDate >= startDate);

  const submit = () => {
    if (!valid) return;
    const name = shownTitle.trim() || autoTitle;
    if (mode === "single") {
      const range = monthRange(month);
      onSave({ title: name, targetCents: cents!, period: null, startDate: range.from, endDate: range.to });
    } else if (mode === "repeat") {
      onSave({ title: name, targetCents: cents!, period: repeat, startDate: null, endDate: null });
    } else {
      onSave({ title: name, targetCents: cents!, period: null, startDate, endDate });
    }
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label={goal ? "Цель" : "Новая цель"}
      header={
        <SheetHeader
          title={goal ? "Цель" : "Новая цель"}
          onCancel={onClose}
          onDone={submit}
          doneDisabled={!valid}
          doneLabel={goal ? "Готово" : "Добавить"}
        />
      }
    >
      <Segmented<Mode>
        label="Тип цели"
        value={mode}
        onChange={setMode}
        options={[
          { value: "single", label: "На месяц" },
          { value: "repeat", label: "Регулярно" },
          { value: "custom", label: "Свой срок" },
        ]}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-3 rounded-[20px] bg-surface px-4"
      >
        {mode === "single" && (
          <label className="relative flex h-14 items-center gap-3 border-b border-line">
            <CalendarRange size={18} className="shrink-0 text-muted-2" />
            <span className="flex-1 text-[15px] font-medium">Месяц</span>
            <span className="flex items-center gap-1 text-[15px] font-bold">
              {monthLabel(month, today)}
              <ChevronsUpDown size={15} className="text-muted-2" />
            </span>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              aria-label="Месяц цели"
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {monthOptions(today, existingMonth).map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m, today)}
                </option>
              ))}
            </select>
          </label>
        )}
        <input
          value={shownTitle}
          onChange={(e) => {
            setTitleTouched(true);
            setTitle(e.target.value);
          }}
          autoFocus={!goal && mode !== "single"}
          maxLength={100}
          placeholder={mode === "single" ? autoTitle : "Название, например «Подушка безопасности»"}
          aria-label="Название цели"
          className="h-14 w-full bg-transparent text-[17px] font-semibold outline-none placeholder:text-muted"
        />
        <label className="flex h-14 items-center gap-2 border-t border-line">
          <span className="flex-1 text-[15px] font-medium">Сумма</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,\s]/g, ""))}
            autoFocus={!goal && mode === "single"}
            inputMode="decimal"
            placeholder="0"
            aria-label="Целевая сумма"
            className="w-36 bg-transparent text-right text-[17px] font-bold tabular-nums outline-none placeholder:text-muted"
          />
          <span className="font-bold text-muted-2">{currencySymbol(currency)}</span>
        </label>
      </form>

      {mode === "single" && (
        <p className="px-3 pt-2 text-[12px] text-muted-2">
          Считаются доходы с 1 по последнее число месяца. На каждый месяц можно поставить свою цель.
        </p>
      )}

      {mode === "repeat" && (
        <section className="mt-3 rounded-[20px] bg-surface p-3">
          <Segmented<GoalPeriod>
            label="Как часто"
            value={repeat}
            onChange={setRepeat}
            options={[
              { value: "month", label: "Каждый месяц" },
              { value: "year", label: "Каждый год" },
            ]}
          />
          <p className="px-1 pt-3 text-[13px] text-muted-2">
            Одна и та же сумма; прогресс считается заново в начале каждого {repeat === "month" ? "месяца" : "года"}.
          </p>
        </section>
      )}

      {mode === "custom" && (
        <section className="mt-3 space-y-2 rounded-[20px] bg-surface px-4 py-3">
          <label className="flex items-center justify-between gap-3">
            <span className="text-[15px] font-medium">Считать с</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => e.target.value && setStartDate(e.target.value)}
              aria-label="Считать с"
              className={fieldClass}
            />
          </label>
          <div className="flex min-h-11 items-center justify-between gap-3">
            <span className="text-[15px] font-medium">Дедлайн</span>
            <div className="flex items-center gap-3">
              {endDate && (
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => e.target.value && setEndDate(e.target.value)}
                  aria-label="Дедлайн"
                  className={fieldClass}
                />
              )}
              <Switch
                label="Дедлайн"
                checked={endDate != null}
                onChange={(on) => setEndDate(on ? shiftDate(today, 90) : null)}
              />
            </div>
          </div>
          {endDate && endDate < startDate && <p className="text-[12px] font-semibold">Дедлайн раньше даты начала</p>}
        </section>
      )}

      {onDelete && (
        <Pressable
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true);
            onDelete();
            onClose();
          }}
          className={cn(
            "mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-[20px] font-semibold transition-colors",
            confirmDelete ? "bg-ink text-on-ink" : "bg-surface",
          )}
        >
          <Trash2 size={18} />
          {confirmDelete ? "Точно удалить?" : "Удалить цель"}
        </Pressable>
      )}
    </BottomSheet>
  );
}
