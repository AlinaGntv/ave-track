// Чистая логика календаря: видимые дни, раскладка задач по сетке времени, будущие
// вхождения повторяющихся задач. Без БД и UI, покрыта тестами.
import { addDays, format, parseISO, startOfISOWeek } from "date-fns";
import { ru } from "date-fns/locale";
import { nextOccurrence } from "@/features/recurrence/next";
import { DEFAULT_DURATION, type TaskItem } from "@/features/tasks/model";

export const CALENDAR_VIEWS = ["day", "3days", "week"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

const fmt = (d: Date) => format(d, "yyyy-MM-dd");
const DAY_MINUTES = 24 * 60;

export function isCalendarView(value: string | undefined): value is CalendarView {
  return (CALENDAR_VIEWS as readonly string[]).includes(value ?? "");
}

/** Дни на экране: неделя — с понедельника, «3 дня» и «день» — начиная с опорной даты. */
export function visibleDays(anchor: string, view: CalendarView): string[] {
  const d = parseISO(anchor);
  if (view === "week") {
    const monday = startOfISOWeek(d);
    return Array.from({ length: 7 }, (_, i) => fmt(addDays(monday, i)));
  }
  const count = view === "3days" ? 3 : 1;
  return Array.from({ length: count }, (_, i) => fmt(addDays(d, i)));
}

/** Листание «‹ ›»: на неделю, на 3 дня или на день. */
export function shiftAnchor(anchor: string, view: CalendarView, direction: 1 | -1): string {
  const step = view === "week" ? 7 : view === "3days" ? 3 : 1;
  return fmt(addDays(parseISO(anchor), step * direction));
}

/** Заголовок: «Ноябрь 2026» или «30 нояб. – 6 дек.» на стыке месяцев. */
export function rangeTitle(days: string[]): string {
  const first = parseISO(days[0]!);
  const last = parseISO(days.at(-1)!);
  const month = (d: Date) => {
    const s = format(d, "LLLL yyyy", { locale: ru });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  if (format(first, "yyyy-MM") === format(last, "yyyy-MM")) return month(first);
  return `${format(first, "d MMM", { locale: ru })} – ${format(last, "d MMM", { locale: ru })}`;
}

export function minutesOf(hhmm: string): number {
  const [h = "0", m = "0"] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

export function timeOf(minutes: number): string {
  if (minutes >= DAY_MINUTES) return "24:00";
  const clamped = Math.max(0, Math.min(DAY_MINUTES - 1, minutes));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/** Время по вертикальному смещению в сетке, с шагом snap минут (тап по пустому месту). */
export function timeAtOffset(offsetY: number, hourHeight: number, snap = 30): string {
  const minutes = Math.floor((offsetY / hourHeight) * 60 / snap) * snap;
  return timeOf(Math.max(0, Math.min(DAY_MINUTES - snap, minutes)));
}

// ───────────── перетаскивание ─────────────

/** Шаг переноса и растягивания блоков, минут. Минутный шаг позволяет ставить задачи вплотную. */
export const DRAG_SNAP = 1;

const snapTo = (minutes: number, snap: number) => Math.round(minutes / snap) * snap;

/**
 * Перенос блока: pointer — минута под пальцем, grab — где внутри блока его взяли
 * (минут от начала). Длительность сохраняется, блок не выходит за пределы суток.
 */
export function moveBlock(
  block: { start: number; end: number },
  pointer: number,
  grab: number,
  snap = DRAG_SNAP,
): { start: number; end: number } {
  const duration = block.end - block.start;
  const start = Math.max(0, Math.min(DAY_MINUTES - duration, snapTo(pointer - grab, snap)));
  return { start, end: start + duration };
}

/** Растягивание за нижний край: меняется только конец, минимум один шаг. */
export function resizeBlock(
  block: { start: number; end: number },
  pointer: number,
  snap = DRAG_SNAP,
): { start: number; end: number } {
  const end = Math.max(block.start + Math.max(snap, 5), Math.min(DAY_MINUTES, snapTo(pointer, snap)));
  return { start: block.start, end };
}

// ───────────── вхождения задач ─────────────

/**
 * Даты задачи в диапазоне [from, to]. У повторяющейся — следующие вхождения по правилу
 * (с учётом окончания: «до даты» и «N раз» — уже выполненные вхождения засчитываются).
 * projected — будущее вхождение, а не текущий срок задачи.
 */
export function occurrencesInRange(
  task: Pick<TaskItem, "dueDate" | "recurrence" | "completionCount" | "completedAt">,
  from: string,
  to: string,
): Array<{ date: string; projected: boolean }> {
  if (!task.dueDate) return [];
  const result: Array<{ date: string; projected: boolean }> = [];
  if (task.dueDate >= from && task.dueDate <= to) result.push({ date: task.dueDate, projected: false });
  const rule = task.recurrence;
  if (!rule || task.completedAt != null) return result;

  let current = task.dueDate;
  // Текущий срок — вхождение номер completionCount + 1; дальше считаем, пока не выйдем за диапазон
  let index = task.completionCount + 1;
  for (let guard = 0; guard < 2000; guard++) {
    if (rule.end.type === "count" && index >= rule.end.count) break;
    current = nextOccurrence(rule, current);
    index++;
    if (current > to) break;
    if (rule.end.type === "until" && current > rule.end.date) break;
    if (current >= from) result.push({ date: current, projected: true });
  }
  return result;
}

// ───────────── раскладка по сетке ─────────────

export type CalendarItem = {
  /** Уникален в пределах экрана (id задачи + дата вхождения) */
  key: string;
  task: TaskItem;
  date: string;
  projected: boolean;
  /** ID записи истории для завершённого вхождения повтора */
  completionId?: number;
  /** Явный отрезок расписания для конкретного дня. */
  segmentId?: number;
};

export type TimedItem = CalendarItem & {
  start: number; // минуты от полуночи
  end: number;
  /** Колонка и число колонок в группе пересекающихся задач */
  column: number;
  columns: number;
};

/**
 * Пересекающиеся по времени задачи ставятся рядом, как в календарях:
 * каждая занимает первую свободную колонку своей группы.
 */
export function layoutTimed<T extends { start: number; end: number }>(items: T[]): Array<T & { column: number; columns: number }> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const result: Array<T & { column: number; columns: number }> = [];
  let group: Array<T & { column: number; columns: number }> = [];
  let groupEnd = -1;
  let columnEnds: number[] = [];

  const flush = () => {
    const columns = Math.max(1, columnEnds.length);
    for (const item of group) item.columns = columns;
    result.push(...group);
    group = [];
    columnEnds = [];
  };

  for (const item of sorted) {
    if (group.length && item.start >= groupEnd) flush();
    let column = columnEnds.findIndex((end) => end <= item.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(item.end);
    } else {
      columnEnds[column] = item.end;
    }
    group.push({ ...item, column, columns: 1 });
    groupEnd = Math.max(groupEnd, item.end);
  }
  flush();
  return result;
}

export type CalendarDay = { date: string; allDay: CalendarItem[]; timed: TimedItem[] };

export type CalendarSegment = { id: number; taskId: number; date: string; startTime: string; durationMinutes: number };

/** Задачи по дням экрана: «весь день» (без времени) и блоки по времени с раскладкой. */
export function buildCalendar(
  tasks: readonly (TaskItem & { completionId?: number })[],
  days: string[],
  segments: readonly CalendarSegment[] = [],
): CalendarDay[] {
  const from = days[0]!;
  const to = days.at(-1)!;
  const byDay = new Map<string, { allDay: CalendarItem[]; timed: Array<CalendarItem & { start: number; end: number }> }>(
    days.map((d) => [d, { allDay: [], timed: [] }]),
  );
  const segmentsByOccurrence = new Map<string, CalendarSegment[]>();
  for (const segment of segments) {
    const key = `${segment.taskId}:${segment.date}`;
    const list = segmentsByOccurrence.get(key) ?? [];
    list.push(segment);
    segmentsByOccurrence.set(key, list);
  }

  for (const task of tasks) {
    for (const { date, projected } of occurrencesInRange(task, from, to)) {
      const day = byDay.get(date);
      if (!day) continue;
      const item: CalendarItem = {
        key: task.completionId != null ? `completion:${task.completionId}` : `${task.id}:${date}`,
        task,
        date,
        projected,
        completionId: task.completionId,
      };
      const overrides = segmentsByOccurrence.get(`${task.id}:${date}`);
      if (overrides?.length) {
        for (const segment of overrides) {
          const start = minutesOf(segment.startTime);
          const end = Math.min(DAY_MINUTES, start + segment.durationMinutes);
          day.timed.push({
            ...item,
            key: `segment:${segment.id}`,
            segmentId: segment.id,
            task: { ...task, dueTime: segment.startTime, durationMinutes: segment.durationMinutes },
            start,
            end: Math.max(end, start + 20),
          });
        }
        continue;
      }
      if (!task.dueTime) {
        day.allDay.push(item);
        continue;
      }
      const start = minutesOf(task.dueTime);
      const end = Math.min(DAY_MINUTES, start + (task.durationMinutes ?? DEFAULT_DURATION));
      // слишком короткие блоки всё равно должны быть читаемы — минимум 20 минут высоты
      day.timed.push({ ...item, start, end: Math.max(end, start + 20) });
    }
  }

  return days.map((date) => {
    const day = byDay.get(date)!;
    return {
      date,
      allDay: day.allDay.sort((a, b) => b.task.priority - a.task.priority || a.task.id - b.task.id),
      timed: layoutTimed(day.timed),
    };
  });
}
