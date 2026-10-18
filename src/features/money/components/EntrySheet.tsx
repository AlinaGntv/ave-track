"use client";

import { Calendar, MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import { shiftDate } from "@/shared/lib/dates";
import { currencySymbol } from "@/shared/lib/money";
import { cn } from "@/shared/lib/cn";
import { BottomSheet, SheetHeader } from "@/shared/ui/BottomSheet";
import { Pressable } from "@/shared/ui/Pressable";
import { centsToInput, parseAmount, type MoneyEntryItem } from "../model";
import type { EntryInput } from "../server";

/** Добавление/редактирование записи о доходе. Монтируется заново на каждое открытие (key). */
export function EntrySheet({
  open,
  entry,
  today,
  currency,
  recentNotes,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  entry?: MoneyEntryItem;
  today: string;
  currency: string;
  recentNotes: string[];
  onClose: () => void;
  onSave: (input: EntryInput) => void;
  onDelete?: () => void;
}) {
  const [amount, setAmount] = useState(entry ? centsToInput(entry.amountCents) : "");
  const [date, setDate] = useState(entry?.date ?? today);
  const [note, setNote] = useState(entry?.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cents = parseAmount(amount);
  const submit = () => {
    if (cents == null) return;
    onSave({ amountCents: cents, date, note: note.trim() || null });
    onClose();
  };
  const yesterday = shiftDate(today, -1);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label={entry ? "Запись" : "Новый доход"}
      header={
        <SheetHeader
          title={entry ? "Запись" : "Новый доход"}
          onCancel={onClose}
          onDone={submit}
          doneDisabled={cents == null}
          doneLabel={entry ? "Готово" : "Добавить"}
        />
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="flex items-baseline justify-center gap-2 rounded-[24px] bg-surface px-4 pt-7 pb-6">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,\s]/g, ""))}
            autoFocus={!entry}
            inputMode="decimal"
            enterKeyHint="done"
            placeholder="0"
            aria-label="Сумма"
            size={Math.max(1, amount.length)}
            className="max-w-[75%] min-w-[1ch] bg-transparent text-right text-[44px] leading-none font-bold tabular-nums outline-none placeholder:text-muted"
          />
          <span className="text-[28px] font-bold text-muted-2">{currencySymbol(currency)}</span>
        </label>

        <div className="mt-3 divide-y divide-line overflow-hidden rounded-[20px] bg-surface">
          <div className="flex min-h-14 items-center gap-3 px-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink">
              <Calendar size={16} />
            </span>
            <div className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto py-2">
              {[
                { value: today, label: "Сегодня" },
                { value: yesterday, label: "Вчера" },
              ].map((chip) => (
                <Pressable
                  key={chip.value}
                  onClick={() => setDate(chip.value)}
                  className={cn(
                    "h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors",
                    date === chip.value ? "bg-ink text-on-ink" : "bg-bg",
                  )}
                >
                  {chip.label}
                </Pressable>
              ))}
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                aria-label="Дата"
                className="h-9 rounded-full bg-bg px-3 text-base font-semibold outline-none"
              />
            </div>
          </div>
          <label className="flex min-h-14 items-center gap-3 px-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink">
              <MessageSquare size={16} />
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="Источник или комментарий"
              aria-label="Источник или комментарий"
              className="h-12 min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:text-muted"
            />
          </label>
        </div>

        {recentNotes.length > 0 && (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            {recentNotes.map((n) => (
              <Pressable
                key={n}
                onClick={() => setNote(n)}
                className={cn(
                  "h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors",
                  note === n ? "bg-ink text-on-ink" : "bg-surface",
                )}
              >
                {n}
              </Pressable>
            ))}
          </div>
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
            {confirmDelete ? "Точно удалить?" : "Удалить запись"}
          </Pressable>
        )}
      </form>
    </BottomSheet>
  );
}
