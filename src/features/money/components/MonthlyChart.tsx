"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { formatDate } from "@/shared/lib/dates";
import { formatMoney } from "@/shared/lib/money";
import { cn } from "@/shared/lib/cn";
import { spring } from "@/shared/ui/motion";
import type { MonthTotal } from "../model";

/**
 * Минималистичный столбчатый график по месяцам.
 * Столбик выезжает снизу через translateY (анимируется только transform),
 * поэтому скругление верха не искажается. Тап по столбику показывает сумму.
 */
export function MonthlyChart({ months, currency }: { months: MonthTotal[]; currency: string }) {
  const [selected, setSelected] = useState(months.length - 1);
  const max = Math.max(...months.map((m) => m.total), 1);
  const current = months[selected] ?? months.at(-1)!;
  const average = Math.round(months.reduce((s, m) => s + m.total, 0) / months.length);

  return (
    <section className="mx-4 rounded-[28px] bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-muted-2 capitalize">
            {formatDate(`${current.month}-01`, "LLLL yyyy")}
          </p>
          <p className="mt-0.5 text-[22px] font-bold tabular-nums">{formatMoney(current.total, currency)}</p>
        </div>
        <p className="text-right text-[12px] text-muted-2">
          в среднем
          <br />
          <span className="font-semibold text-fg tabular-nums">{formatMoney(average, currency, { compact: true })}</span>
        </p>
      </div>

      <div className="mt-5 flex h-32 items-end gap-1.5" role="list" aria-label="Доход по месяцам">
        {months.map((m, i) => {
          const ratio = m.total / max;
          const active = i === selected;
          return (
            <button
              key={m.month}
              type="button"
              role="listitem"
              aria-label={`${m.label}: ${formatMoney(m.total, currency)}`}
              onClick={() => setSelected(i)}
              className="flex h-full min-w-0 flex-1 flex-col items-center gap-2"
            >
              <span className="relative w-full flex-1 overflow-hidden rounded-[8px]">
                <motion.span
                  initial={{ y: "100%" }}
                  animate={{ y: `${(1 - Math.max(ratio, m.total > 0 ? 0.04 : 0)) * 100}%` }}
                  transition={{ ...spring.smooth, delay: i * 0.025 }}
                  className={cn(
                    "absolute inset-0 rounded-[8px] transition-colors duration-200",
                    active ? "bg-ink" : "bg-surface-2",
                  )}
                />
              </span>
              <span className={cn("text-[10px] font-semibold", active ? "text-fg" : "text-muted")}>{m.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
