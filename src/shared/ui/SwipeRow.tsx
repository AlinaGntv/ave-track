"use client";

import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { haptic } from "@/shared/lib/haptics";
import { cn } from "@/shared/lib/cn";
import { spring } from "./motion";

export type SwipeAction = { icon: LucideIcon; label: string; onTrigger: () => void };

/** Пороги в px: короткий свайп вправо, длинный вправо, свайп влево */
const LEAD = 64;
const LEAD_FULL = 150;
const TRAIL = -96;

type Stage = "none" | "lead" | "leadFull" | "trail";

function stageOf(x: number, has: { lead: boolean; full: boolean; trail: boolean }): Stage {
  if (has.full && x >= LEAD_FULL) return "leadFull";
  if (has.lead && x >= LEAD) return "lead";
  if (has.trail && x <= TRAIL) return "trail";
  return "none";
}

/**
 * Строка со свайпами, как в iOS: вправо — короткое действие (флажок),
 * дальше — полное (выполнить); влево — удаление (строка уезжает за край).
 * Двигается только transform; вертикальный скролл не блокируется (direction lock).
 */
export function SwipeRow({
  lead,
  leadFull,
  trail,
  className,
  children,
}: {
  lead?: SwipeAction;
  leadFull?: SwipeAction;
  trail?: SwipeAction;
  className?: string;
  children: ReactNode;
}) {
  const x = useMotionValue(0);
  const [stage, setStage] = useState<Stage>("none");
  const dragged = useRef(false);
  const has = { lead: !!lead, full: !!leadFull, trail: !!trail };

  useMotionValueEvent(x, "change", (value) => {
    const next = stageOf(value, has);
    if (next !== stage) {
      if (next !== "none") haptic();
      setStage(next);
    }
  });

  const leadOpacity = useTransform(x, [8, LEAD], [0, 1]);
  const trailOpacity = useTransform(x, [-8, TRAIL], [0, 1]);
  const leadAction = stage === "leadFull" ? leadFull : lead;
  const LeadIcon = leadAction?.icon;
  const TrailIcon = trail?.icon;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-0 flex items-center justify-between bg-ink px-6 text-on-ink" aria-hidden>
        <motion.span style={{ opacity: leadOpacity }} className="flex items-center gap-2 text-[13px] font-bold">
          {LeadIcon && (
            <motion.span
              key={stage === "leadFull" ? "full" : "lead"}
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={spring.snappy}
            >
              <LeadIcon size={20} strokeWidth={2.4} />
            </motion.span>
          )}
          {leadAction?.label}
        </motion.span>
        <motion.span style={{ opacity: trailOpacity }} className="flex items-center gap-2 text-[13px] font-bold">
          {trail?.label}
          {TrailIcon && <TrailIcon size={20} strokeWidth={2.2} />}
        </motion.span>
      </div>

      <motion.div
        style={{ x, touchAction: "pan-y" }}
        drag="x"
        dragDirectionLock
        dragMomentum={false}
        dragElastic={0}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={(_, info) => {
          const final = stageOf(info.offset.x, has);
          if (final === "trail" && trail) {
            // Удаление: строка уезжает за левый край, затем действие
            void animate(x, -window.innerWidth, { ...spring.smooth, velocity: info.velocity.x }).then(() =>
              trail.onTrigger(),
            );
          } else {
            void animate(x, 0, spring.smooth);
            if (final === "leadFull") leadFull?.onTrigger();
            else if (final === "lead") lead?.onTrigger();
          }
          // Клик, который браузер пришлёт после отпускания, не должен открывать задачу
          setTimeout(() => (dragged.current = false), 50);
        }}
        onClickCapture={(e) => {
          if (dragged.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  );
}
