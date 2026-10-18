"use client";

import { motion } from "framer-motion";
import { formatDate, shiftDate } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import { spring } from "@/shared/ui/motion";
import { Pressable } from "@/shared/ui/Pressable";

/** Лента дней недели с «таблеткой» выбранного дня, как на экране Today в дизайне. */
export function WeekStrip({
  today,
  selected,
  onSelect,
}: {
  today: string;
  selected: string;
  onSelect: (date: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(today, i - 3));

  return (
    <div className="flex justify-between px-4">
      {days.map((day) => {
        const active = day === selected;
        return (
          <Pressable
            key={day}
            onClick={() => onSelect(day)}
            className="relative flex h-[76px] w-11 flex-col items-center justify-center gap-1"
          >
            {active && (
              <motion.span
                layoutId="week-pill"
                transition={spring.smooth}
                className="absolute inset-0 rounded-full bg-ink shadow-soft"
              />
            )}
            <span
              className={cn(
                "relative text-[13px] font-medium tabular-nums transition-colors",
                active ? "text-on-ink" : "text-muted",
              )}
            >
              {formatDate(day, "d")}
            </span>
            <span
              className={cn(
                "relative text-[13px] font-medium capitalize transition-colors",
                active ? "text-on-ink" : "text-muted",
              )}
            >
              {formatDate(day, "EEEEEE")}
            </span>
            {day === today && (
              <span className={cn("relative h-1 w-1 rounded-full", active ? "bg-on-ink" : "bg-fg")} />
            )}
          </Pressable>
        );
      })}
    </div>
  );
}
