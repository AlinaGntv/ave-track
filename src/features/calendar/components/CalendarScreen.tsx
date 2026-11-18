"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { useQuickAddHandler, useTaskEditor } from "@/features/tasks/components/TaskEditorProvider";
import type { ListOption } from "@/features/tasks/components/TaskEditorSheet";
import { useOptimisticTasks } from "@/features/tasks/hooks";
import { updateCompletedOccurrenceAction } from "@/features/tasks/actions";
import { DEFAULT_DURATION, draftFromTask, emptyDraft, isDone, PRIORITIES, type TaskItem } from "@/features/tasks/model";
import { formatDate, nowTimeIn } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import { spring } from "@/shared/ui/motion";
import { Pressable } from "@/shared/ui/Pressable";
import { RefreshButton } from "@/shared/ui/RefreshButton";
import { useToast } from "@/shared/ui/Toast";
import { Segmented } from "@/shared/ui/Segmented";
import {
  buildCalendar,
  minutesOf,
  rangeTitle,
  shiftAnchor,
  timeAtOffset,
  timeOf,
  visibleDays,
  type CalendarItem,
  type CalendarView,
  type TimedItem,
} from "../model";
import { useCalendarDrag, type DragPreview } from "./useCalendarDrag";

/** Высота часа в сетке, px */
const HOUR = 56;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const VIEW_KEY = "avetrack-calendar-view";

/** Тон блока по списку: списки различаются оттенками серого (палитра строго ч/б) */
const TONES = [
  "bg-tone-1 text-on-tone-1",
  "bg-tone-2 text-on-tone-2",
  "bg-tone-3 text-on-tone-3",
  "bg-tone-4 text-on-tone-4 ring-1 ring-inset ring-line",
];

function preferredView(): CalendarView {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "day" || saved === "3days" || saved === "week") return saved;
  } catch {
    // приватный режим
  }
  return window.matchMedia("(min-width: 1024px)").matches ? "week" : "3days";
}

export function CalendarScreen({
  anchor,
  view: viewFromUrl,
  today,
  tasks: serverTasks,
  lists,
  inboxId,
  timezone,
}: {
  anchor: string;
  /** null — режим не указан в адресе: выбирается по экрану (и запоминается) */
  view: CalendarView | null;
  today: string;
  tasks: TaskItem[];
  lists: ListOption[];
  inboxId: number;
  /** Часовой пояс из настроек — для линии «сейчас» */
  timezone: string;
}) {
  const router = useRouter();
  const view = viewFromUrl ?? "week";
  const { tasks, save, remove, complete, uncomplete } = useOptimisticTasks(serverTasks, today);
  const toast = useToast();
  const { openEditor } = useTaskEditor();
  const scroller = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState<number | null>(null);

  const go = (date: string, nextView: CalendarView) =>
    router.push(`/calendar?date=${date}&view=${nextView}`, { scroll: false });

  // Режим не указан — подставляем предпочтительный для этого устройства
  useEffect(() => {
    if (!viewFromUrl) router.replace(`/calendar?date=${anchor}&view=${preferredView()}`, { scroll: false });
  }, [viewFromUrl, anchor, router]);

  // Линия «сейчас» — обновляется раз в минуту
  useEffect(() => {
    const tick = () => setNow(minutesOf(nowTimeIn(timezone)));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [timezone]);

  // При открытии — прокрутка к утру (или к текущему часу, если сегодня на экране)
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const hour = visibleDays(anchor, view).includes(today) && now != null ? Math.max(0, now / 60 - 1.5) : 7.5;
    el.scrollTop = hour * HOUR;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, view]);

  const days = useMemo(() => visibleDays(anchor, view), [anchor, view]);
  const calendar = useMemo(() => buildCalendar(tasks, days), [tasks, days]);

  // Перетаскивание: новое время (и день) подставляется в задачу сразу, без открытия редактора
  const drag = useCalendarDrag({
    grid,
    scroller,
    hourHeight: HOUR,
    daysKey: days.join(),
    onDrop: ({ item, mode, dayIndex, start, end }) => {
      const task = item.task;
      if (item.completionId != null) {
        void updateCompletedOccurrenceAction(item.completionId, {
          dueDate: days[dayIndex] ?? item.date,
          dueTime: timeOf(start),
          durationMinutes: end - start,
        })
          .then(() => router.refresh())
          .catch((error) => {
            console.error(error);
            toast.show({ message: "Не удалось сохранить изменения" });
          });
        return;
      }
      save(
        {
          ...draftFromTask(task),
          dueDate: days[dayIndex] ?? item.date,
          dueTime: timeOf(start),
          // При переносе фиксируем текущую видимую длительность, включая час по умолчанию.
          durationMinutes: end - start,
        },
        task,
      );
    },
  });

  const toneOf = useMemo(() => {
    const index = new Map(lists.map((l, i) => [l.id, i]));
    return (listId: number) => TONES[(index.get(listId) ?? 0) % TONES.length]!;
  }, [lists]);

  const setView = (next: CalendarView) => {
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // не страшно
    }
    go(anchor, next);
  };

  const createAt = (date: string, time: string | null) =>
    openEditor({
      defaults: { ...emptyDraft(inboxId), dueDate: date, dueTime: time, durationMinutes: time ? DEFAULT_DURATION : null },
      onSubmit: (d) => save(d),
    });

  useQuickAddHandler(() => createAt(days.includes(today) ? today : days[0]!, null));

  const open = (item: CalendarItem) => {
    if (item.task.id < 0 || drag.consumeClick()) return;
    openEditor({ task: item.task, onSubmit: (d) => save(d, item.task), onDelete: () => remove(item.task) });
  };
  const toggle = (item: CalendarItem) => {
    if (item.task.id < 0 || item.projected) return;
    if (isDone(item.task)) uncomplete(item.task);
    else complete(item.task);
  };

  const onGridClick = (date: string) => (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || drag.consumeClick()) return; // клик по блоку или конец перетаскивания
    const rect = e.currentTarget.getBoundingClientRect();
    createAt(date, timeAtOffset(e.clientY - rect.top, HOUR));
  };

  const columns = `3rem repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div className="flex h-[calc(100dvh-env(safe-area-inset-top)-96px-env(safe-area-inset-bottom))] flex-col lg:h-[calc(100dvh-3rem)]">
      {/* Шапка: месяц, режим, навигация */}
      <header className="shrink-0 px-4 pt-5 pb-3 lg:px-6 lg:pt-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="truncate text-[26px] leading-tight font-bold tracking-tight lg:text-[30px]">{rangeTitle(days)}</h1>
          <div className="flex shrink-0 items-center">
            <RefreshButton size="sm" />
            <Pressable aria-label="Назад" onClick={() => go(shiftAnchor(anchor, view, -1), view)} className="flex h-11 w-9 items-center justify-center">
              <ChevronLeft size={20} />
            </Pressable>
            <Pressable
              onClick={() => go(today, view)}
              className="h-9 rounded-full bg-surface px-3.5 text-[13px] font-semibold"
            >
              Сегодня
            </Pressable>
            <Pressable aria-label="Вперёд" onClick={() => go(shiftAnchor(anchor, view, 1), view)} className="flex h-11 w-9 items-center justify-center">
              <ChevronRight size={20} />
            </Pressable>
          </div>
        </div>
        <div className="mt-3 lg:max-w-sm">
          <Segmented<CalendarView>
            label="Режим календаря"
            value={view}
            onChange={setView}
            options={[
              { value: "day", label: "День" },
              { value: "3days", label: "3 дня" },
              { value: "week", label: "Неделя" },
            ]}
          />
        </div>
      </header>

      {/* Дни недели и задачи «на весь день» */}
      <div className="shrink-0 border-b border-line px-1 lg:px-3" style={{ display: "grid", gridTemplateColumns: columns }}>
        <div />
        {calendar.map((day) => {
          const isToday = day.date === today;
          return (
            <div key={day.date} className="min-w-0 px-0.5 pb-2">
              <button
                type="button"
                onClick={() => go(day.date, "day")}
                className="flex w-full flex-col items-center py-1"
                aria-label={formatDate(day.date, "d MMMM, EEEE")}
              >
                <span className="text-[11px] font-medium text-muted-2 capitalize">{formatDate(day.date, "EEEEEE")}</span>
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-bold tabular-nums",
                    isToday && "bg-ink text-on-ink",
                  )}
                >
                  {formatDate(day.date, "d")}
                </span>
              </button>
              <div className="mt-1 space-y-1">
                {day.allDay.slice(0, 3).map((item) => (
                  <AllDayChip key={item.key} item={item} tone={toneOf(item.task.listId)} onOpen={() => open(item)} />
                ))}
                {day.allDay.length > 3 && (
                  <button
                    type="button"
                    onClick={() => go(day.date, "day")}
                    className="w-full truncate px-1 text-left text-[11px] font-semibold text-muted-2"
                  >
                    ещё {day.allDay.length - 3}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Сетка времени */}
      <div ref={scroller} className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 lg:px-3">
        <div ref={grid} className="relative" style={{ display: "grid", gridTemplateColumns: columns, height: HOUR * 24 }}>
          <div className="relative">
            {HOURS.map((h) =>
              h === 0 ? null : (
                <span
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-muted tabular-nums"
                  style={{ top: h * HOUR }}
                >
                  {timeOf(h * 60)}
                </span>
              ),
            )}
          </div>
          {calendar.map((day, dayIndex) => (
            <div
              key={day.date}
              data-day-col={day.date}
              role="button"
              tabIndex={-1}
              aria-label={`Новая задача на ${formatDate(day.date, "d MMMM")}`}
              onClick={onGridClick(day.date)}
              className="relative cursor-pointer border-l border-line"
              style={{
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR - 1}px, var(--line) ${HOUR - 1}px, var(--line) ${HOUR}px)`,
              }}
            >
              {day.timed.map((item) => (
                <TimedBlock
                  key={item.key}
                  item={item}
                  tone={toneOf(item.task.listId)}
                  dragging={drag.preview?.item.key === item.key}
                  onOpen={() => open(item)}
                  onToggle={() => toggle(item)}
                  onDragStart={(e, mode) => drag.start(e, item, mode)}
                />
              ))}
              {drag.preview?.dayIndex === dayIndex && <DragGhost preview={drag.preview} tone={toneOf(drag.preview.item.task.listId)} />}
              {day.date === today && now != null && (
                <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: (now / 60) * HOUR }}>
                  <span className="-ml-1 h-2.5 w-2.5 rounded-full bg-fg" />
                  <span className="h-[2px] flex-1 bg-fg" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AllDayChip({ item, tone, onOpen }: { item: CalendarItem; tone: string; onOpen: () => void }) {
  const done = isDone(item.task);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex h-6 w-full min-w-0 items-center gap-1 rounded-md px-1.5 text-left text-[11px] font-semibold",
        tone,
        item.projected && "opacity-55",
        done && "opacity-40 line-through",
      )}
    >
      {item.task.recurrence && <Repeat size={10} className="shrink-0" />}
      <span className="truncate">{item.task.title}</span>
    </button>
  );
}

/** Куда встанет перетаскиваемая задача — с новым временем */
function DragGhost({ preview, tone }: { preview: DragPreview; tone: string }) {
  const { item, start, end } = preview;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 p-px"
      style={{ top: (start / 60) * HOUR, height: Math.max(((end - start) / 60) * HOUR, 22) }}
    >
      <div className={cn("flex h-full flex-col overflow-hidden rounded-lg px-1.5 py-1 shadow-soft ring-2 ring-fg", tone)}>
        <p className="truncate text-[11px] leading-tight font-bold">{item.task.title}</p>
        <p className="truncate text-[10px] font-semibold tabular-nums">
          {timeOf(start)}–{timeOf(end)}
        </p>
      </div>
    </div>
  );
}

function TimedBlock({
  item,
  tone,
  dragging,
  onOpen,
  onToggle,
  onDragStart,
}: {
  item: TimedItem;
  tone: string;
  dragging: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onDragStart: (e: PointerEvent, mode: "move" | "resize") => void;
}) {
  const done = isDone(item.task);
  const height = ((item.end - item.start) / 60) * HOUR;
  const compact = height < 40;
  const marks = PRIORITIES[item.task.priority]?.marks;
  return (
    <motion.div
      layout="position"
      transition={spring.smooth}
      className="absolute p-px"
      style={{
        top: (item.start / 60) * HOUR,
        height,
        left: `${(item.column / item.columns) * 100}%`,
        width: `${100 / item.columns}%`,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === "Enter" && onOpen()}
        onPointerDown={(e) => onDragStart(e, "move")}
        className={cn(
          "group relative flex h-full cursor-pointer overflow-hidden rounded-lg px-1.5 py-1 text-left transition-transform select-none [-webkit-touch-callout:none] active:scale-[0.98]",
          tone,
          dragging && "opacity-30",
          item.projected && "opacity-55 [background-image:repeating-linear-gradient(135deg,transparent_0,transparent_6px,rgba(127,127,127,.18)_6px,rgba(127,127,127,.18)_8px)]",
          done && "opacity-40",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-[11px] leading-tight font-bold", done && "line-through", !compact && "whitespace-normal line-clamp-2")}>
            {marks && <span className="mr-0.5">{marks}</span>}
            {item.task.title}
          </p>
          {!compact && (
            <p className="mt-0.5 truncate text-[10px] opacity-75 tabular-nums">
              {timeOf(item.start)}–{timeOf(item.end)}
              {item.task.recurrence && " · 🔁"}
            </p>
          )}
        </div>
        {!compact && !item.projected && (
          <button
            type="button"
            aria-label={done ? "Вернуть" : "Выполнить"}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="-mt-0.5 -mr-1 flex h-7 w-7 shrink-0 items-start justify-center pt-0.5"
          >
            <span
              className={cn(
                "h-3.5 w-3.5 rounded-full border-[1.5px] border-current",
                done && "bg-current",
              )}
            />
          </button>
        )}
        {!item.projected && (
          <span
            aria-hidden
            onPointerDown={(e) => {
              e.stopPropagation();
              onDragStart(e, "resize");
            }}
            className="absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize touch-none items-end justify-center pb-0.5"
          >
            <span className="h-[3px] w-5 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-50 [@media(hover:none)]:opacity-30" />
          </span>
        )}
      </div>
    </motion.div>
  );
}
