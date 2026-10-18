"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { formatMoney } from "@/shared/lib/money";
import { cn } from "@/shared/lib/cn";
import { spring } from "@/shared/ui/motion";
import { Waves } from "@/shared/ui/Waves";
import { plural } from "@/features/recurrence/describe";
import { describeGoalPeriod, type GoalItem, type GoalProgress } from "../model";

function ProgressRing({ percent, size = 64 }: { percent: number; size?: number }) {
  const value = Math.min(1, percent / 100);
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" className="-rotate-90" width={size} height={size} aria-hidden>
        <circle cx="32" cy="32" r="27" fill="none" strokeWidth="6" className="stroke-current opacity-15" />
        <motion.circle
          cx="32"
          cy="32"
          r="27"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className="stroke-current"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: value }}
          transition={{ ...spring.smooth, delay: 0.1 }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[14px] font-bold tabular-nums">
        {percent >= 100 ? <Check size={20} strokeWidth={2.6} /> : `${percent}%`}
      </span>
    </span>
  );
}

function deadlineText(goal: GoalItem, progress: GoalProgress): string {
  if (progress.achieved) return "Цель достигнута";
  if (progress.expired) return "Срок вышел";
  if (progress.daysLeft != null) {
    if (progress.daysLeft === 0) return "Последний день";
    return `Осталось ${progress.daysLeft} ${plural(progress.daysLeft, ["день", "дня", "дней"])}`;
  }
  return describeGoalPeriod(goal);
}

/** Карточка цели — как карточки проектов в дизайне: первая тёмная, остальные светлые. */
export function GoalCard({
  goal,
  progress,
  currency,
  primary,
  onOpen,
}: {
  goal: GoalItem;
  progress: GoalProgress;
  currency: string;
  primary?: boolean;
  onOpen: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
      className={cn(
        "relative flex h-[208px] w-[200px] shrink-0 snap-start flex-col overflow-hidden rounded-[30px] p-5 text-left",
        primary ? "bg-ink text-on-ink shadow-soft" : "bg-surface text-fg",
      )}
    >
      {primary && <Waves className="text-on-ink opacity-15" />}
      <ProgressRing percent={progress.percent} />
      <p className="relative mt-4 line-clamp-2 text-[16px] leading-snug font-bold">{goal.title}</p>
      <p className={cn("relative mt-1 text-[13px] tabular-nums", primary ? "text-on-ink-muted" : "text-muted-2")}>
        {formatMoney(progress.earnedCents, currency, { compact: true })} из{" "}
        {formatMoney(goal.targetCents, currency, { compact: true })}
      </p>
      <p
        className={cn(
          "relative mt-auto text-[12px] font-semibold",
          primary ? "text-on-ink-muted" : "text-muted-2",
        )}
      >
        {progress.achieved || progress.remainingCents === 0
          ? deadlineText(goal, progress)
          : `Ещё ${formatMoney(progress.remainingCents, currency, { compact: true })} · ${deadlineText(goal, progress).toLowerCase()}`}
      </p>
    </motion.button>
  );
}
