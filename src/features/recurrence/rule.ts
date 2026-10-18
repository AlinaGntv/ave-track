// Правило повтора хранится в tasks.recurrence как JSON (не RRULE):
// zod даёт валидацию и типы, а нужное подмножество RFC 5545 считается
// маленькой чистой функцией (next.ts) без проблем rrule.js с часовыми поясами.
// Даты — локальные "YYYY-MM-DD" в часовом поясе пользователя, поэтому переходы
// на летнее/зимнее время на вычисления не влияют.
import { getDate, getISODay, parseISO } from "date-fns";
import { z } from "zod";

/** ISO-день недели: 1 — понедельник … 7 — воскресенье */
const weekday = z.number().int().min(1).max(7);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const recurrenceSchema = z.object({
  freq: z.enum(["day", "week", "month", "year"]),
  interval: z.number().int().min(1).max(999),
  /** Только для freq = "week": конкретные дни недели */
  weekdays: z.array(weekday).max(7).optional(),
  /** Только для freq = "month": число месяца или «N-й день недели» (-1 — последний) */
  monthly: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("day"), day: z.number().int().min(1).max(31) }),
      z.object({
        type: z.literal("nth"),
        nth: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)]),
        weekday,
      }),
    ])
    .optional(),
  end: z.discriminatedUnion("type", [
    z.object({ type: z.literal("never") }),
    z.object({ type: z.literal("until"), date: isoDate }),
    /** Всего вхождений, включая первое */
    z.object({ type: z.literal("count"), count: z.number().int().min(1).max(9999) }),
  ]),
});

export type Recurrence = z.infer<typeof recurrenceSchema>;
export type Frequency = Recurrence["freq"];
export type MonthlyRule = NonNullable<Recurrence["monthly"]>;

/** Убирает поля, не относящиеся к частоте, сортирует и дедуплицирует дни недели. */
export function normalizeRecurrence(rule: Recurrence): Recurrence {
  const result: Recurrence = { freq: rule.freq, interval: rule.interval, end: rule.end };
  if (rule.freq === "week" && rule.weekdays?.length) {
    result.weekdays = [...new Set(rule.weekdays)].sort((a, b) => a - b);
  }
  if (rule.freq === "month" && rule.monthly) result.monthly = rule.monthly;
  return result;
}

export function parseRecurrence(json: string | null | undefined): Recurrence | null {
  if (!json) return null;
  try {
    const parsed = recurrenceSchema.safeParse(JSON.parse(json));
    return parsed.success ? normalizeRecurrence(parsed.data) : null;
  } catch {
    return null;
  }
}

export function serializeRecurrence(rule: Recurrence | null): string | null {
  return rule ? JSON.stringify(normalizeRecurrence(rule)) : null;
}

/** Правило по умолчанию для выбранной частоты, привязанное к дате задачи. */
export function defaultRecurrence(freq: Frequency, dueDate: string): Recurrence {
  const date = parseISO(dueDate);
  const base = { freq, interval: 1, end: { type: "never" as const } };
  if (freq === "week") return { ...base, weekdays: [getISODay(date)] };
  if (freq === "month") return { ...base, monthly: { type: "day", day: getDate(date) } };
  return base;
}
