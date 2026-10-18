"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { formatMoney } from "@/shared/lib/money";
import { cn } from "@/shared/lib/cn";
import { AnimatedNumber } from "@/shared/ui/AnimatedNumber";
import { spring } from "@/shared/ui/motion";
import { Pressable, PressableLink } from "@/shared/ui/Pressable";
import { Waves } from "@/shared/ui/Waves";
import { MONEY_PERIODS, PERIOD_SHORT, periodLabel, type MoneyPeriod, type PeriodTotals } from "../model";
import type { GoalWithProgress } from "../server";

const STORAGE_KEY = "avetrack-money-period";

/** Выбранный период запоминается на устройстве (не критично, если хранилище недоступно). */
function usePeriod(): [MoneyPeriod, (p: MoneyPeriod) => void] {
  const [period, setPeriod] = useState<MoneyPeriod>("month");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (MONEY_PERIODS as readonly string[]).includes(saved)) setPeriod(saved as MoneyPeriod);
    } catch {
      // приватный режим
    }
  }, []);
  return [
    period,
    (p) => {
      setPeriod(p);
      try {
        localStorage.setItem(STORAGE_KEY, p);
      } catch {
        // приватный режим
      }
    },
  ];
}

/** Денежный блок — тёмная шапка с волнами из дизайна. */
export function MoneyHero({
  totals,
  currency,
  today,
  goal,
  onAdd,
  href,
}: {
  totals: PeriodTotals;
  currency: string;
  today: string;
  /** Цель, прогресс которой показывается внизу карточки */
  goal?: GoalWithProgress;
  onAdd: () => void;
  /** Ссылка «подробнее» (на главной ведёт на экран денег) */
  href?: string;
}) {
  const [period, setPeriod] = usePeriod();
  const format = (cents: number) => formatMoney(cents, currency);

  return (
    <section className="relative mx-3 overflow-hidden rounded-[32px] bg-ink text-on-ink shadow-soft">
      <Waves className="text-on-ink opacity-20" />
      <div className="relative px-6 pt-5 pb-5">
        <div className="flex items-center justify-between gap-3">
          {href ? (
            <PressableLink href={href} className="-ml-1 flex h-11 items-center gap-1 px-1 text-sm text-on-ink-muted">
              Заработано {periodLabel(period, today)}
              <ArrowUpRight size={15} />
            </PressableLink>
          ) : (
            <p className="text-sm text-on-ink-muted">Заработано {periodLabel(period, today)}</p>
          )}
          <Pressable
            aria-label="Добавить доход"
            onClick={onAdd}
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-on-ink text-ink">
              <Plus size={18} strokeWidth={2.4} />
            </span>
          </Pressable>
        </div>

        <AnimatedNumber
          value={totals[period]}
          format={format}
          className="mt-1 block text-[40px] leading-none font-bold tracking-tight tabular-nums"
        />

        <div role="radiogroup" aria-label="Период" className="mt-5 flex gap-1 rounded-full bg-on-ink/10 p-1">
          {MONEY_PERIODS.map((p) => {
            const active = p === period;
            return (
              <Pressable
                key={p}
                role="radio"
                aria-checked={active}
                onClick={() => setPeriod(p)}
                className="relative h-9 flex-1 rounded-full text-[13px] font-semibold"
              >
                {active && (
                  <motion.span
                    layoutId="money-period-pill"
                    transition={spring.smooth}
                    className="absolute inset-0 rounded-full bg-on-ink"
                  />
                )}
                <span className={cn("relative transition-colors", active ? "text-ink" : "text-on-ink-muted")}>
                  {PERIOD_SHORT[p]}
                </span>
              </Pressable>
            );
          })}
        </div>

        {goal && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="truncate font-semibold">{goal.title}</span>
              <span className="shrink-0 text-on-ink-muted tabular-nums">
                {goal.progress.percent}% · {formatMoney(goal.targetCents, currency, { compact: true })}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-on-ink/15">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: Math.min(1, goal.progress.percent / 100) }}
                transition={{ ...spring.smooth, delay: 0.15 }}
                className="h-full origin-left rounded-full bg-on-ink"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
