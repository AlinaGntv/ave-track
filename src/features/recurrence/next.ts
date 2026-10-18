import {
  addDays,
  addMonths,
  addYears,
  format,
  getDate,
  getDaysInMonth,
  getISODay,
  parseISO,
  startOfISOWeek,
} from "date-fns";
import type { MonthlyRule, Recurrence } from "./rule";

const fmt = (date: Date) => format(date, "yyyy-MM-dd");
const MAX_STEPS = 10_000;

/** День месяца по правилу; null — такого дня в этом месяце нет. */
function dayInMonth(monthStart: Date, rule: MonthlyRule): string | null {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = getDaysInMonth(monthStart);

  if (rule.type === "day") {
    // 31-е в коротких месяцах прижимается к последнему дню (30-е, 28/29 февраля)
    return fmt(new Date(year, month, Math.min(rule.day, daysInMonth)));
  }
  if (rule.nth === -1) {
    const last = new Date(year, month, daysInMonth);
    const back = (getISODay(last) - rule.weekday + 7) % 7;
    return fmt(new Date(year, month, daysInMonth - back));
  }
  const offset = (rule.weekday - getISODay(monthStart) + 7) % 7;
  const day = 1 + offset + (rule.nth - 1) * 7;
  return day <= daysInMonth ? fmt(new Date(year, month, day)) : null;
}

/**
 * Следующее вхождение строго после `from`.
 * `from` задаёт «якорь» серии: от него отсчитываются интервалы.
 */
export function nextOccurrence(rule: Recurrence, from: string): string {
  const date = parseISO(from);
  switch (rule.freq) {
    case "day":
      return fmt(addDays(date, rule.interval));

    case "year":
      return fmt(addYears(date, rule.interval));

    case "week": {
      const days = rule.weekdays?.length ? [...rule.weekdays].sort((a, b) => a - b) : null;
      if (!days) return fmt(addDays(date, 7 * rule.interval));
      const current = getISODay(date);
      const later = days.find((d) => d > current);
      if (later) return fmt(addDays(date, later - current));
      // Дни этой недели закончились — первый выбранный день через `interval` недель
      return fmt(addDays(startOfISOWeek(date), 7 * rule.interval + days[0]! - 1));
    }

    case "month": {
      const monthly: MonthlyRule = rule.monthly ?? { type: "day", day: getDate(date) };
      const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      for (let k = 0; k < MAX_STEPS; k++) {
        const candidate = dayInMonth(addMonths(firstOfMonth, k * rule.interval), monthly);
        if (candidate && candidate > from) return candidate;
      }
      throw new Error("Не удалось вычислить следующую дату");
    }
  }
}

/**
 * Новая дата задачи после выполнения очередного вхождения.
 *
 * - Пропущенные вхождения не накапливаются: дата переносится на первое вхождение
 *   строго позже max(срок задачи, сегодня). Просроченная ежедневная задача,
 *   выполненная сегодня, переезжает на завтра, а не на вчерашнюю дату.
 * - `completedCount` — сколько раз серия выполнена с учётом текущего раза.
 * - null — серия закончилась, задачу нужно отметить выполненной окончательно.
 */
export function nextDueAfterCompletion(
  rule: Recurrence,
  dueDate: string,
  today: string,
  completedCount: number,
): string | null {
  if (rule.end.type === "count" && completedCount >= rule.end.count) return null;

  const after = dueDate > today ? dueDate : today;
  let current = dueDate;
  for (let i = 0; i < MAX_STEPS && current <= after; i++) {
    current = nextOccurrence(rule, current);
  }
  if (current <= after) throw new Error("Не удалось вычислить следующую дату");

  if (rule.end.type === "until" && current > rule.end.date) return null;
  return current;
}
