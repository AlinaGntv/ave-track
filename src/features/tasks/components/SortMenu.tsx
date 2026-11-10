"use client";

import { ArrowDownAZ, ArrowUpDown, CalendarClock, Check, Flag, GripVertical, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { Pressable } from "@/shared/ui/Pressable";
import { SORT_LABELS, SORT_MODES, type SortMode } from "../model";

const ICONS: Record<SortMode, LucideIcon> = {
  due: CalendarClock,
  priority: Flag,
  title: ArrowDownAZ,
  manual: GripVertical,
};

const HINTS: Record<SortMode, string> = {
  due: "Ближайшие и просроченные сверху, без даты — в конце",
  priority: "Сначала важные, внутри — по сроку",
  title: "По алфавиту",
  manual: "Свой порядок — перетаскивайте за ручку",
};

/** Кнопка «↕ По сроку» над списком и окно выбора сортировки. */
export function SortMenu({ value, onChange }: { value: SortMode; onChange: (mode: SortMode) => void }) {
  const [sheet, setSheet] = useState<{ key: number; open: boolean } | null>(null);
  const close = () => setSheet((s) => (s ? { ...s, open: false } : s));

  return (
    <>
      <Pressable
        onClick={() => setSheet((s) => ({ key: (s?.key ?? 0) + 1, open: true }))}
        aria-label={`Сортировка: ${SORT_LABELS[value]}`}
        className="-my-1 flex h-11 items-center"
      >
        <span className="flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-semibold text-muted-2">
          <ArrowUpDown size={14} />
          {SORT_LABELS[value]}
        </span>
      </Pressable>

      {sheet && (
        <BottomSheet
          key={sheet.key}
          open={sheet.open}
          onClose={close}
          label="Сортировка"
          header={<h2 className="px-4 pt-2 pb-3 text-center text-[16px] font-bold">Сортировка</h2>}
        >
          <div role="radiogroup" aria-label="Сортировка" className="divide-y divide-line overflow-hidden rounded-[20px] bg-surface">
            {SORT_MODES.map((mode) => {
              const Icon = ICONS[mode];
              const active = mode === value;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    onChange(mode);
                    close();
                  }}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      active ? "bg-ink text-on-ink" : "bg-bg text-fg",
                    )}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{SORT_LABELS[mode]}</span>
                    <span className="block text-[12px] text-muted-2">{HINTS[mode]}</span>
                  </span>
                  {active && <Check size={18} className="shrink-0" />}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
