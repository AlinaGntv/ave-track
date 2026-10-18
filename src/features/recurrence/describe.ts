import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import type { MonthlyRule, Recurrence } from "./rule";

/** Русское множественное число: plural(5, ["день", "дня", "дней"]) → "дней" */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const WEEKDAY_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"] as const;
export const WEEKDAY_NAMES = [
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
  "воскресенье",
] as const;
/** Винительный падеж: «в среду», «в пятницу» */
const WEEKDAY_ACC = ["понедельник", "вторник", "среду", "четверг", "пятницу", "субботу", "воскресенье"];
/** Род дня недели: м — пн, вт, чт; ж — ср, пт, сб; ср — вс */
const WEEKDAY_GENDER = ["m", "m", "f", "m", "f", "f", "n"] as const;

const ORDINALS: Record<string, Record<"m" | "f" | "n", string>> = {
  "1": { m: "первый", f: "первую", n: "первое" },
  "2": { m: "второй", f: "вторую", n: "второе" },
  "3": { m: "третий", f: "третью", n: "третье" },
  "4": { m: "четвёртый", f: "четвёртую", n: "четвёртое" },
  "-1": { m: "последний", f: "последнюю", n: "последнее" },
};

export const NTH_LABELS: Array<{ value: 1 | 2 | 3 | 4 | -1; label: string }> = [
  { value: 1, label: "Первый" },
  { value: 2, label: "Второй" },
  { value: 3, label: "Третий" },
  { value: 4, label: "Четвёртый" },
  { value: -1, label: "Последний" },
];

/** Единицы интервала после «раз в N …» — родительный/винительный по числу */
export const UNIT_FORMS: Record<Recurrence["freq"], [string, string, string]> = {
  day: ["день", "дня", "дней"],
  week: ["неделю", "недели", "недель"],
  month: ["месяц", "месяца", "месяцев"],
  year: ["год", "года", "лет"],
};

const EVERY: Record<Recurrence["freq"], string> = {
  day: "Каждый день",
  week: "Каждую неделю",
  month: "Каждый месяц",
  year: "Каждый год",
};

function describeMonthly(rule: MonthlyRule): string {
  if (rule.type === "day") return `${rule.day}-го числа`;
  const index = rule.weekday - 1;
  const ordinal = ORDINALS[String(rule.nth)]![WEEKDAY_GENDER[index]!];
  const preposition = ordinal.startsWith("вт") ? "во" : "в";
  return `${preposition} ${ordinal} ${WEEKDAY_ACC[index]}`;
}

function describeWeekdays(days: number[]): string {
  const key = [...days].sort((a, b) => a - b).join(",");
  if (key === "1,2,3,4,5") return "по будням";
  if (key === "6,7") return "по выходным";
  return days.map((d) => WEEKDAY_SHORT[d - 1]).join(", ");
}

/**
 * «Каждый день», «Раз в 2 недели: пн, ср, пт», «Каждый месяц, во второй вторник»,
 * «Каждый год, до 31 дек. 2027», «Раз в 3 дня, 10 раз».
 */
export function describeRecurrence(rule: Recurrence): string {
  let text =
    rule.interval === 1
      ? EVERY[rule.freq]
      : `Раз в ${rule.interval} ${plural(rule.interval, UNIT_FORMS[rule.freq])}`;

  if (rule.freq === "week" && rule.weekdays?.length) text += `: ${describeWeekdays(rule.weekdays)}`;
  if (rule.freq === "month" && rule.monthly) text += `, ${describeMonthly(rule.monthly)}`;

  if (rule.end.type === "until") {
    text += `, до ${format(parseISO(rule.end.date), "d MMM yyyy", { locale: ru })}`;
  } else if (rule.end.type === "count") {
    text += `, ${rule.end.count} ${plural(rule.end.count, ["раз", "раза", "раз"])}`;
  }
  return text;
}
