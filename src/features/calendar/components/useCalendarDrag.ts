"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { DEFAULT_DURATION } from "@/features/tasks/model";
import { moveBlock, resizeBlock, type TimedItem } from "../model";

export type DragMode = "move" | "resize";

/** Состояние перетаскивания для отрисовки: куда сейчас «встанет» блок */
export type DragPreview = {
  item: TimedItem;
  mode: DragMode;
  dayIndex: number;
  start: number;
  end: number;
};

type Pending = {
  item: TimedItem;
  mode: DragMode;
  pointerId: number;
  pointerType: string;
  x: number;
  y: number;
  /** Где внутри блока взяли, минут от его начала */
  grab: number;
  /** Настоящая длительность (у коротких блоков на экране она растянута до 20 минут) */
  block: { start: number; end: number };
  timer: ReturnType<typeof setTimeout> | null;
};

/** Зажать на телефоне, мс — короче, и перетаскивание мешает прокрутке */
const LONG_PRESS = 350;
/** Сдвиг, после которого мышь начинает тащить, а палец — считается прокруткой, px */
const MOVE_THRESHOLD = 5;
/** Зона у края сетки, где при перетаскивании включается автопрокрутка, px */
const EDGE = 56;

/**
 * Перетаскивание задач в сетке календаря: перенос (в другое время и другой день)
 * и растягивание за нижний край. Мышь тащит сразу, палец — после долгого нажатия,
 * чтобы обычный свайп по-прежнему прокручивал календарь.
 */
export function useCalendarDrag({
  grid,
  scroller,
  hourHeight,
  daysKey,
  onDrop,
}: {
  grid: RefObject<HTMLDivElement | null>;
  scroller: RefObject<HTMLDivElement | null>;
  hourHeight: number;
  /** Набор дней на экране: при листании или смене режима перетаскивание отменяется */
  daysKey: string;
  onDrop: (preview: DragPreview) => void;
}) {
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const pending = useRef<Pending | null>(null);
  const active = useRef<DragPreview | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const autoScroll = useRef<ReturnType<typeof setInterval> | null>(null);
  const suppressClick = useRef(0);
  const cleanup = useRef<(() => void) | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  /** Минута и колонка дня под точкой экрана */
  const locate = useCallback(
    (x: number, y: number) => {
      const el = grid.current;
      if (!el) return null;
      const columns = [...el.querySelectorAll<HTMLElement>("[data-day-col]")];
      if (!columns.length) return null;
      let dayIndex = columns.findIndex((c) => {
        const r = c.getBoundingClientRect();
        return x >= r.left && x < r.right;
      });
      if (dayIndex === -1) dayIndex = x < columns[0]!.getBoundingClientRect().left ? 0 : columns.length - 1;
      const minutes = ((y - el.getBoundingClientRect().top) / hourHeight) * 60;
      return { dayIndex, minutes };
    },
    [grid, hourHeight],
  );

  const update = useCallback(() => {
    const p = pending.current;
    const point = last.current;
    if (!p || !point || !active.current) return;
    const at = locate(point.x, point.y);
    if (!at) return;
    const next =
      p.mode === "move" ? moveBlock(p.block, at.minutes, p.grab) : resizeBlock(p.block, at.minutes);
    const dayIndex = p.mode === "move" && p.item.segmentId == null ? at.dayIndex : active.current.dayIndex;
    const prev = active.current;
    if (prev.dayIndex === dayIndex && prev.start === next.start && prev.end === next.end) return;
    active.current = { ...prev, dayIndex, ...next };
    setPreview(active.current);
  }, [locate]);

  const stop = useCallback(() => {
    if (pending.current?.timer) clearTimeout(pending.current.timer);
    if (autoScroll.current) clearInterval(autoScroll.current);
    autoScroll.current = null;
    cleanup.current?.();
    cleanup.current = null;
    pending.current = null;
    active.current = null;
    last.current = null;
    setPreview(null);
  }, []);

  const activate = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    p.timer = null;
    active.current = { item: p.item, mode: p.mode, dayIndex: dayIndexOf(p.item), start: p.block.start, end: p.block.end };
    setPreview(active.current);
    navigator.vibrate?.(8);
    update();
    // Автопрокрутка, пока палец или курсор у верхнего/нижнего края сетки
    autoScroll.current = setInterval(() => {
      const box = scroller.current;
      const point = last.current;
      if (!box || !point) return;
      const r = box.getBoundingClientRect();
      const delta = point.y < r.top + EDGE ? -1 : point.y > r.bottom - EDGE ? 1 : 0;
      if (!delta) return;
      const depth = delta < 0 ? r.top + EDGE - point.y : point.y - (r.bottom - EDGE);
      box.scrollTop += delta * Math.min(18, 4 + depth / 4);
      update();
    }, 16);

    function dayIndexOf(item: TimedItem) {
      const el = grid.current;
      const columns = el ? [...el.querySelectorAll<HTMLElement>("[data-day-col]")] : [];
      const index = columns.findIndex((c) => c.dataset.dayCol === item.date);
      return Math.max(0, index);
    }
  }, [grid, scroller, update]);

  const start = useCallback(
    (e: ReactPointerEvent, item: TimedItem, mode: DragMode) => {
      if ((item.projected && item.segmentId == null) || item.task.id < 0) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (mode === "move" && (e.target as Element).closest("button")) return; // кружок «выполнить»
      stop();

      const at = locate(e.clientX, e.clientY);
      const end = Math.min(24 * 60, item.start + (item.task.durationMinutes ?? DEFAULT_DURATION));
      const block = { start: item.start, end: Math.max(end, item.start + 5) };
      pending.current = {
        item,
        mode,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        x: e.clientX,
        y: e.clientY,
        grab: at ? Math.max(0, at.minutes - item.start) : 0,
        block,
        timer: null,
      };
      last.current = { x: e.clientX, y: e.clientY };
      // Палец: перенос — после долгого нажатия; растягивание за ручку — сразу (у ручки touch-action: none)
      if (e.pointerType !== "mouse" && mode === "move") {
        pending.current.timer = setTimeout(activate, LONG_PRESS);
      }

      const onMove = (ev: PointerEvent) => {
        const p = pending.current;
        if (!p || ev.pointerId !== p.pointerId) return;
        last.current = { x: ev.clientX, y: ev.clientY };
        if (active.current) return update();
        const moved = Math.hypot(ev.clientX - p.x, ev.clientY - p.y) > MOVE_THRESHOLD;
        if (!moved) return;
        if (p.pointerType === "mouse" || p.mode === "resize") activate();
        else stop(); // палец сдвинулся раньше долгого нажатия — это прокрутка
      };
      const onUp = (ev: PointerEvent) => {
        const p = pending.current;
        if (!p || ev.pointerId !== p.pointerId) return;
        const result = active.current;
        if (result) {
          suppressClick.current = Date.now() + 400;
          const changed =
            result.dayIndex !== dayIndexAtStart(result.item) || result.start !== p.block.start || result.end !== p.block.end;
          if (changed) onDropRef.current(result);
        }
        stop();
      };
      const onCancel = (ev: PointerEvent) => {
        if (pending.current && ev.pointerId === pending.current.pointerId) stop();
      };
      // Во время перетаскивания пальцем страница не должна прокручиваться
      const onTouchMove = (ev: TouchEvent) => {
        if (active.current) ev.preventDefault();
      };
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") stop();
      };
      const onContextMenu = (ev: Event) => {
        if (active.current || pending.current?.timer) ev.preventDefault();
      };
      function dayIndexAtStart(item: TimedItem) {
        const el = grid.current;
        const columns = el ? [...el.querySelectorAll<HTMLElement>("[data-day-col]")] : [];
        return Math.max(0, columns.findIndex((c) => c.dataset.dayCol === item.date));
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("keydown", onKey);
      window.addEventListener("contextmenu", onContextMenu);
      cleanup.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("contextmenu", onContextMenu);
      };
    },
    [activate, grid, locate, stop, update],
  );

  useEffect(() => stop, [stop]);
  // Сменился набор дней (листание, режим) — незаконченное перетаскивание отменяется
  useEffect(() => stop(), [daysKey, stop]);

  /** Клик сразу после перетаскивания — не открытие редактора */
  const consumeClick = useCallback(() => Date.now() < suppressClick.current, []);

  return { preview, start, consumeClick };
}
