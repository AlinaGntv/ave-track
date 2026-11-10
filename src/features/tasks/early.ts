// Ранние напоминания: «за месяц», «за 2 недели», «за неделю» до срока задачи.
// Хранятся в tasks.early_reminders как JSON-массив коротких строк: "1m", "2w", "7d".
// Чистая логика — без БД и UI, покрыта тестами.
import { format, parseISO, subDays, subMonths, subWeeks } from "date-fns";
import { plural } from "@/features/recurrence/describe";

export type EarlyUnit = "d" | "w" | "m";
export type EarlyOffset = `${number}${EarlyUnit}`;

const OFFSET_RE = /^([1-9]\d{0,2})([dwm])$/;
export const MAX_EARLY_REMINDERS = 10;

/** Быстрый выбор в окне задачи */
export const EARLY_PRESETS: EarlyOffset[] = ["1d", "3d", "1w", "2w", "1m"];

export function parseOffset(value: string): { amount: number; unit: EarlyUnit } | null {
  const match = OFFSET_RE.exec(value);
  return match ? { amount: Number(match[1]), unit: match[2] as EarlyUnit } : null;
}

/** Примерная длина в днях — только для сортировки */
function approxDays(value: string): number {
  const o = parseOffset(value);
  if (!o) return 0;
  return o.amount * (o.unit === "d" ? 1 : o.unit === "w" ? 7 : 30);
}

/** Убирает мусор и дубли, сортирует от самого раннего («за месяц») к позднему («за день»). */
export function normalizeEarly(values: readonly string[] | null | undefined): EarlyOffset[] {
  const valid = [...new Set((values ?? []).filter((v) => parseOffset(v) != null))] as EarlyOffset[];
  return valid.sort((a, b) => approxDays(b) - approxDays(a)).slice(0, MAX_EARLY_REMINDERS);
}

export function parseEarlyJson(json: string | null | undefined): EarlyOffset[] {
  if (!json) return [];
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? normalizeEarly(value.filter((v) => typeof v === "string")) : [];
  } catch {
    return [];
  }
}

export function serializeEarly(values: readonly string[]): string | null {
  const normalized = normalizeEarly(values);
  return normalized.length ? JSON.stringify(normalized) : null;
}

const UNIT_FORMS: Record<EarlyUnit, [string, string, string]> = {
  d: ["день", "дня", "дней"],
  w: ["неделю", "недели", "недель"],
  m: ["месяц", "месяца", "месяцев"],
};

/** «месяц», «2 недели», «10 дней»: единица без числа, если число 1 */
function amountText(value: string): string {
  const o = parseOffset(value);
  if (!o) return value;
  const unit = plural(o.amount, UNIT_FORMS[o.unit]);
  return o.amount === 1 ? unit : `${o.amount} ${unit}`;
}

/** «за неделю», «за 2 недели», «за 10 дней» */
export function earlyLabel(value: string): string {
  return `за ${amountText(value)}`;
}

/** «Через неделю», «Через 2 недели» — заголовок напоминания */
export function earlyHeadline(value: string): string {
  return `Через ${amountText(value)}`;
}

/** Кратко для строки в окне задачи: «за месяц, 2 недели, неделю» */
export function describeEarly(values: readonly string[]): string {
  const normalized = normalizeEarly(values);
  if (normalized.length === 0) return "Нет";
  return `за ${normalized.map(amountText).join(", ")}`;
}

/** Дата, в которую должно прийти напоминание. 31-е «за месяц» прижимается к концу короткого месяца. */
export function earlyReminderDate(dueDate: string, value: string): string | null {
  const o = parseOffset(value);
  if (!o) return null;
  const due = parseISO(dueDate);
  const date = o.unit === "d" ? subDays(due, o.amount) : o.unit === "w" ? subWeeks(due, o.amount) : subMonths(due, o.amount);
  return format(date, "yyyy-MM-dd");
}

export type DueEarlyReminder<T> = { task: T; offset: EarlyOffset; sentFor: string };

/**
 * Какие ранние напоминания пора отправить сейчас: дата напоминания — сегодня, и наступило
 * время отправки (время утренней сводки). Если worker был выключен утром, напоминание
 * догоняет в тот же день. Ключ sentFor (срок + смещение) защищает от повторов и меняется
 * у повторяющейся задачи вместе с новой датой.
 */
export function dueEarlyReminders<T extends { dueDate: string | null; earlyReminders: readonly string[] }>(
  tasks: readonly T[],
  today: string,
  now: string,
  sendTime: string,
): DueEarlyReminder<T>[] {
  if (now < sendTime) return [];
  const result: DueEarlyReminder<T>[] = [];
  for (const task of tasks) {
    if (!task.dueDate || task.dueDate <= today) continue; // в сам день срока — обычная сводка
    for (const offset of normalizeEarly(task.earlyReminders)) {
      if (earlyReminderDate(task.dueDate, offset) === today) {
        result.push({ task, offset, sentFor: `${task.dueDate}:${offset}` });
      }
    }
  }
  return result;
}
