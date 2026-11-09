// Чистая логика денежного трекера: периоды, суммы, прогресс целей, помесячный график.
// Суммы — целые центы, даты — локальные "YYYY-MM-DD".
import {
  addMonths,
  differenceInCalendarDays,
  endOfISOWeek,
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfISOWeek,
  startOfMonth,
  startOfYear,
  subMonths,
} from "date-fns";
import { ru } from "date-fns/locale";

export type MoneyEntryItem = { id: number; amountCents: number; date: string; note: string | null };

export type GoalPeriod = "month" | "year";

export type GoalItem = {
  id: number;
  title: string;
  targetCents: number;
  /** Повторяющаяся цель «каждый месяц/год» — считается по текущему периоду */
  period: GoalPeriod | null;
  /** Для разовой цели: с какой даты считать и дедлайн (необязателен) */
  startDate: string | null;
  endDate: string | null;
};

export const MONEY_PERIODS = ["week", "month", "year", "all"] as const;
export type MoneyPeriod = (typeof MONEY_PERIODS)[number];

/** Границы включительно; null — без ограничения. */
export type DateRange = { from: string | null; to: string | null };

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

export function periodRange(period: MoneyPeriod, today: string): DateRange {
  const d = parseISO(today);
  switch (period) {
    case "week":
      return { from: fmt(startOfISOWeek(d)), to: fmt(endOfISOWeek(d)) };
    case "month":
      return { from: fmt(startOfMonth(d)), to: fmt(endOfMonth(d)) };
    case "year":
      return { from: fmt(startOfYear(d)), to: fmt(endOfYear(d)) };
    case "all":
      return { from: null, to: null };
  }
}

export function inRange(date: string, range: DateRange): boolean {
  return (range.from == null || date >= range.from) && (range.to == null || date <= range.to);
}

export function sumInRange(entries: Array<Pick<MoneyEntryItem, "amountCents" | "date">>, range: DateRange): number {
  let total = 0;
  for (const e of entries) if (inRange(e.date, range)) total += e.amountCents;
  return total;
}

export type PeriodTotals = Record<MoneyPeriod, number>;

export function periodTotals(entries: Array<Pick<MoneyEntryItem, "amountCents" | "date">>, today: string): PeriodTotals {
  return {
    week: sumInRange(entries, periodRange("week", today)),
    month: sumInRange(entries, periodRange("month", today)),
    year: sumInRange(entries, periodRange("year", today)),
    all: sumInRange(entries, periodRange("all", today)),
  };
}

/** Добавляет сумму записи к тем периодам, в которые попадает её дата (для оптимистичного UI). */
export function addToTotals(totals: PeriodTotals, entry: Pick<MoneyEntryItem, "amountCents" | "date">, today: string): PeriodTotals {
  const next = { ...totals };
  for (const period of MONEY_PERIODS) {
    if (inRange(entry.date, periodRange(period, today))) next[period] += entry.amountCents;
  }
  return next;
}

export const PERIOD_SHORT: Record<MoneyPeriod, string> = {
  week: "Неделя",
  month: "Месяц",
  year: "Год",
  all: "Всё",
};

/** «за эту неделю», «за октябрь», «за 2026 год», «за всё время» */
export function periodLabel(period: MoneyPeriod, today: string): string {
  const d = parseISO(today);
  switch (period) {
    case "week":
      return "за эту неделю";
    case "month":
      return `за ${format(d, "LLLL", { locale: ru })}`;
    case "year":
      return `за ${format(d, "yyyy")} год`;
    case "all":
      return "за всё время";
  }
}

// ───────────── цели ─────────────

export function goalRange(goal: GoalItem, today: string): DateRange {
  if (goal.period) return periodRange(goal.period, today);
  return { from: goal.startDate, to: goal.endDate };
}

export type GoalProgress = {
  earnedCents: number;
  /** 0–100, может быть больше 100 при перевыполнении */
  percent: number;
  remainingCents: number;
  achieved: boolean;
  /** Сколько дней осталось до конца периода/дедлайна (0 — последний день); null — бессрочно */
  daysLeft: number | null;
  /** Дедлайн прошёл, а цель не достигнута */
  expired: boolean;
  /** Период цели ещё не начался (например, цель на следующий месяц) */
  upcoming: boolean;
  /** Период цели уже закончился — достигнута она или нет */
  finished: boolean;
};

export function goalProgress(goal: GoalItem, entries: Array<Pick<MoneyEntryItem, "amountCents" | "date">>, today: string): GoalProgress {
  const range = goalRange(goal, today);
  const earnedCents = sumInRange(entries, range);
  const percent = goal.targetCents > 0 ? Math.floor((earnedCents / goal.targetCents) * 100) : 0;
  const achieved = earnedCents >= goal.targetCents;
  const daysLeft = range.to ? differenceInCalendarDays(parseISO(range.to), parseISO(today)) : null;
  const finished = daysLeft != null && daysLeft < 0;
  return {
    earnedCents,
    percent,
    remainingCents: Math.max(0, goal.targetCents - earnedCents),
    achieved,
    daysLeft,
    expired: !achieved && finished,
    upcoming: range.from != null && range.from > today,
    finished,
  };
}

// ───────────── цели на конкретный месяц ─────────────
// Хранятся как разовая цель (period = null) с датами от 1-го до последнего числа месяца.

/** Границы месяца "YYYY-MM" */
export function monthRange(month: string): { from: string; to: string } {
  const first = parseISO(`${month}-01`);
  return { from: format(first, "yyyy-MM-dd"), to: format(endOfMonth(first), "yyyy-MM-dd") };
}

/** "YYYY-MM", если цель ровно на один календарный месяц, иначе null. */
export function goalMonth(goal: Pick<GoalItem, "period" | "startDate" | "endDate">): string | null {
  if (goal.period || !goal.startDate || !goal.endDate) return null;
  const month = goal.startDate.slice(0, 7);
  const range = monthRange(month);
  return goal.startDate === range.from && goal.endDate === range.to ? month : null;
}

/** «Ноябрь»; для другого года — «Январь 2028». */
export function monthLabel(month: string, today: string): string {
  const d = parseISO(`${month}-01`);
  const name = format(d, "LLLL", { locale: ru });
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  return month.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${month.slice(0, 4)}`;
}

/**
 * Месяцы для выбора: год назад и год вперёд от текущего. Прошедшие нужны, чтобы закрепить
 * цель за уже закончившимся месяцем (например, 1 ноября — за октябрём). Месяц уже
 * сохранённой цели добавляется, даже если он вне этого окна.
 */
export function monthOptions(today: string, include?: string | null): string[] {
  const current = startOfMonth(parseISO(today));
  const months = Array.from({ length: 25 }, (_, i) => format(addMonths(current, i - 12), "yyyy-MM"));
  if (include && !months.includes(include)) {
    months.push(include);
    months.sort();
  }
  return months;
}

/** Порядок целей: текущие, затем будущие (ближайшие раньше), затем завершённые (свежие раньше). */
export function sortGoals<T extends { goal: GoalItem; progress: GoalProgress }>(goals: T[], today: string): T[] {
  const rank = (p: GoalProgress) => (p.finished ? 2 : p.upcoming ? 1 : 0);
  const start = (g: GoalItem) => goalRange(g, today).from ?? "";
  const end = (g: GoalItem) => goalRange(g, today).to ?? "9999";
  return [...goals].sort((a, b) => {
    const r = rank(a.progress) - rank(b.progress);
    if (r !== 0) return r;
    if (a.progress.upcoming) return start(a.goal) < start(b.goal) ? -1 : 1;
    if (a.progress.finished) return end(a.goal) > end(b.goal) ? -1 : 1;
    return a.goal.id - b.goal.id;
  });
}

export function describeGoalPeriod(goal: GoalItem, today?: string): string {
  if (goal.period === "month") return "Каждый месяц";
  if (goal.period === "year") return "Каждый год";
  const month = goalMonth(goal);
  if (month && today) return monthLabel(month, today);
  if (goal.endDate) return `До ${format(parseISO(goal.endDate), "d MMMM yyyy", { locale: ru })}`;
  if (goal.startDate) return `С ${format(parseISO(goal.startDate), "d MMMM yyyy", { locale: ru })}`;
  return "Без срока";
}

// ───────────── график и список ─────────────

export type MonthTotal = { month: string; label: string; total: number };

/** Ровные трёхбуквенные подписи для узких столбиков (у date-fns «нояб.», «июнь», «март» разной длины) */
const MONTH_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** Суммы за последние `count` месяцев, заканчивая текущим. */
export function monthlyTotals(entries: Array<Pick<MoneyEntryItem, "amountCents" | "date">>, today: string, count = 12): MonthTotal[] {
  const byMonth = new Map<string, number>();
  for (const e of entries) {
    const key = e.date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + e.amountCents);
  }
  const current = startOfMonth(parseISO(today));
  return Array.from({ length: count }, (_, i) => {
    const d = subMonths(current, count - 1 - i);
    const month = format(d, "yyyy-MM");
    return { month, label: MONTH_SHORT[d.getMonth()]!, total: byMonth.get(month) ?? 0 };
  });
}

export type EntryGroup = { month: string; title: string; total: number; entries: MoneyEntryItem[] };

/** Записи по месяцам, новые сверху. */
export function groupEntriesByMonth(entries: MoneyEntryItem[]): EntryGroup[] {
  const sorted = [...entries].sort((a, b) => (a.date === b.date ? Math.abs(b.id) - Math.abs(a.id) : a.date < b.date ? 1 : -1));
  const groups: EntryGroup[] = [];
  for (const entry of sorted) {
    const month = entry.date.slice(0, 7);
    let group = groups.at(-1);
    if (!group || group.month !== month) {
      const title = format(parseISO(`${month}-01`), "LLLL yyyy", { locale: ru });
      group = { month, title: title.charAt(0).toUpperCase() + title.slice(1), total: 0, entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
    group.total += entry.amountCents;
  }
  return groups;
}

// ───────────── ввод сумм ─────────────

export const MAX_AMOUNT_CENTS = 100_000_000_000; // 1 млрд

/** "1 234,56" / "1234.5" / "12" → центы; null — некорректный ввод или не больше нуля. */
export function parseAmount(input: string): number | null {
  const normalized = input.replace(/[\s  ']/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  const [whole = "0", fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return cents > 0 && cents <= MAX_AMOUNT_CENTS ? cents : null;
}

/** Центы → строка для поля ввода: 125050 → "1250,5", 1200 → "12". */
export function centsToInput(cents: number): string {
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  if (fraction === 0) return String(whole);
  return `${whole},${String(fraction).padStart(2, "0").replace(/0$/, "")}`;
}

/**
 * Цель для шапки «Заработано»: текущая недостигнутая, иначе любая текущая.
 * Будущие (ещё не начались) и завершённые в шапку не попадают.
 */
export function pickHeroGoal<T extends { progress: GoalProgress }>(goals: T[]): T | undefined {
  const active = goals.filter((g) => !g.progress.upcoming && !g.progress.finished);
  return active.find((g) => !g.progress.achieved) ?? active[0];
}
