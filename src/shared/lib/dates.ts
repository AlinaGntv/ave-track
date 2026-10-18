import { addDays, format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

/** Локальная дата "YYYY-MM-DD" в часовом поясе пользователя. */
export function todayIn(timezone: string, now: Date = new Date()): string {
  return formatInTimeZone(now, timezone, "yyyy-MM-dd");
}

/** Локальное время "HH:mm" в часовом поясе пользователя. */
export function nowTimeIn(timezone: string, now: Date = new Date()): string {
  return formatInTimeZone(now, timezone, "HH:mm");
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Все часовые пояса IANA, которые знает среда выполнения */
export function listTimeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["Europe/Amsterdam", "Europe/Berlin", "Europe/London", "Europe/Moscow", "UTC"];
  }
}

export function shiftDate(date: string, days: number): string {
  return format(addDays(parseISO(date), days), "yyyy-MM-dd");
}

/** Человекочитаемый формат: formatDate("2026-10-17", "d MMMM yyyy") → "17 октября 2026" */
export function formatDate(date: string, pattern: string): string {
  return format(parseISO(date), pattern, { locale: ru });
}
