"use client";

import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { haptic } from "@/shared/lib/haptics";
import { cn } from "@/shared/lib/cn";
import { spring } from "./motion";
import { decideGesture, LEAD, LEAD_FULL, stageOf, TRAIL, type GestureMode, type SwipeStage } from "./swipe-gesture";

export type SwipeAction = { icon: LucideIcon; label: string; onTrigger: () => void };

type Gesture = { id: number; startX: number; startY: number; mode: GestureMode };

/**
 * Строка со свайпами, как в iOS: вправо — короткое действие (флажок),
 * дальше — полное (выполнить); влево — удаление (строка уезжает за край).
 *
 * Жест распознаётся вручную, а не через drag Framer Motion: строка становится свайпом
 * только при явно горизонтальном движении, любое вертикальное отдаётся прокрутке страницы
 * (touch-action: pan-y). Действие определяется по реальному сдвигу строки.
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
  const [stage, setStage] = useState<SwipeStage>("none");
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
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

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    gesture.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, mode: "pending" };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId || g.mode === "scroll") return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    if (g.mode === "pending") {
      g.mode = decideGesture(dx, dy, has.lead || has.full, has.trail);
      if (g.mode !== "swipe") return; // ещё не ясно или это прокрутка — строку не трогаем
      g.startX = e.clientX; // без рывка на величину порога распознавания
      try {
        e.currentTarget.setPointerCapture(e.pointerId); // палец может уйти за пределы строки
      } catch {
        // указатель уже отпущен — жест просто закончится обычным pointerup
      }
    }

    // Нельзя тянуть в сторону, где нет действия; за порогом — лёгкое сопротивление
    let offset = e.clientX - g.startX;
    if (offset > 0 && !(has.lead || has.full)) offset = 0;
    if (offset < 0 && !has.trail) offset = 0;
    const limit = offset > 0 ? LEAD_FULL + 40 : Math.abs(TRAIL) + 60;
    if (Math.abs(offset) > limit) offset = Math.sign(offset) * (limit + (Math.abs(offset) - limit) * 0.25);
    x.set(offset);
  };

  const finish = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    if (g.mode !== "swipe") return;

    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 80);

    const final = cancelled ? "none" : stageOf(x.get(), has);
    if (final === "trail" && trail) {
      // Удаление: строка уезжает за левый край. Действие — по таймеру, а не по окончании
      // анимации: если анимацию что-то прервёт, удаление всё равно не потеряется
      void animate(x, -window.innerWidth, spring.smooth);
      setTimeout(() => trail.onTrigger(), 180);
      return;
    }
    void animate(x, 0, spring.smooth);
    if (final === "leadFull") leadFull?.onTrigger();
    else if (final === "lead") lead?.onTrigger();
  };

  return (
    <div className={cn("relative overflow-hidden select-none", className)}>
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        onClickCapture={(e) => {
          // Клик, который браузер присылает после свайпа, не должен открывать задачу
          if (suppressClick.current) {
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
