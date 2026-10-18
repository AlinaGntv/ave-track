"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { shiftDate } from "@/shared/lib/dates";
import { currencySymbol } from "@/shared/lib/money";
import { cn } from "@/shared/lib/cn";
import { BottomSheet, SheetHeader } from "@/shared/ui/BottomSheet";
import { Pressable } from "@/shared/ui/Pressable";
import { Segmented } from "@/shared/ui/Segmented";
import { Switch } from "@/shared/ui/Switch";
import { centsToInput, parseAmount, type GoalItem } from "../model";
import type { GoalInput } from "../server";

type Kind = "month" | "year" | "custom";

const fieldClass = "h-11 rounded-[14px] bg-bg px-3 text-base font-semibold outline-none";

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
  const [title, setTitle] = useState(goal?.title ?? "");
  const [amount, setAmount] = useState(goal ? centsToInput(goal.targetCents) : "");
  const [kind, setKind] = useState<Kind>(goal ? (goal.period ?? "custom") : "month");
  const [startDate, setStartDate] = useState(goal?.startDate ?? today);
  const [endDate, setEndDate] = useState<string | null>(goal?.endDate ?? null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cents = parseAmount(amount);
  const valid = title.trim().length > 0 && cents != null && (!endDate || endDate >= startDate);

  const submit = () => {
    if (!valid) return;
    onSave({
      title: title.trim(),
      targetCents: cents!,
      period: kind === "custom" ? null : kind,
      startDate: kind === "custom" ? startDate : null,
      endDate: kind === "custom" ? endDate : null,
    });
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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="rounded-[20px] bg-surface px-4"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus={!goal}
          maxLength={100}
          placeholder="Название, например «Подушка безопасности»"
          aria-label="Название цели"
          className="h-14 w-full bg-transparent text-[17px] font-semibold outline-none placeholder:text-muted"
        />
        <label className="flex h-14 items-center gap-2 border-t border-line">
          <span className="flex-1 text-[15px] font-medium">Сумма</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,\s]/g, ""))}
            inputMode="decimal"
            placeholder="0"
            aria-label="Целевая сумма"
            className="w-36 bg-transparent text-right text-[17px] font-bold tabular-nums outline-none placeholder:text-muted"
          />
          <span className="font-bold text-muted-2">{currencySymbol(currency)}</span>
        </label>
      </form>

      <section className="mt-3 rounded-[20px] bg-surface p-3">
        <p className="px-1 pb-2.5 text-[13px] font-semibold text-muted-2">Период</p>
        <Segmented<Kind>
          label="Период цели"
          value={kind}
          onChange={setKind}
          options={[
            { value: "month", label: "Каждый месяц" },
            { value: "year", label: "Каждый год" },
            { value: "custom", label: "Свой срок" },
          ]}
        />
        {kind !== "custom" ? (
          <p className="px-1 pt-3 text-[13px] text-muted-2">
            Прогресс считается заново в начале каждого {kind === "month" ? "месяца" : "года"}.
          </p>
        ) : (
          <div className="mt-3 space-y-2 px-1">
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
            {endDate && endDate < startDate && (
              <p className="text-[12px] font-semibold">Дедлайн раньше даты начала</p>
            )}
          </div>
        )}
      </section>

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
