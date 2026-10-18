// Чистое форматирование сообщений бота (HTML parse mode) и inline-клавиатур.
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { goalProgress, inRange, periodRange, sumInRange, type GoalItem, type MoneyEntryItem } from "@/features/money/model";
import { plural } from "@/features/recurrence/describe";
import { formatDayTitle, formatDueLabel, PRIORITIES, type Priority } from "@/features/tasks/model";
import { formatDate } from "@/shared/lib/dates";
import { formatMoney } from "@/shared/lib/money";

export type InlineButton = { text: string; callback_data: string } | { text: string; url: string };
export type BotMessage = { text: string; keyboard: InlineButton[][] };

export type DigestStatus = "open" | "done" | "rescheduled";

export type DigestItem = {
  id: number;
  title: string;
  listId: number;
  dueDate: string | null;
  dueTime: string | null;
  priority: Priority;
  flagged: boolean;
  recurring: boolean;
  status: DigestStatus;
  /** Для перенесённой повторяющейся задачи — новая дата */
  nextDue?: string | null;
};

/** Ограничения Telegram: 4096 символов в сообщении, 100 кнопок; берём с запасом */
const MAX_TEXT = 3800;
const MAX_BUTTONS = 30;
const BUTTON_TITLE = 32;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Callback-кнопки: done:<id>:<дата сводки> — после нажатия сводка за эту дату перерисовывается */
export const DIGEST_DONE = /^done:(\d+):(\d{4}-\d{2}-\d{2})$/;
export const REMINDER_DONE = /^rdone:(\d+)$/;

function itemLine(item: DigestItem, date: string): string {
  const marks = PRIORITIES[item.priority]?.marks;
  const title = escapeHtml(item.title);
  const prefix = marks ? `<b>${marks}</b> ` : "";
  const extras: string[] = [];
  if (item.status === "open") {
    if (item.dueDate && item.dueDate < date) {
      extras.push(`<i>просрочено, ${formatDueLabel(item.dueDate, null, date)?.toLowerCase()}</i>`);
    }
    if (item.dueTime) extras.push(item.dueTime);
    if (item.recurring) extras.push("🔁");
    if (item.flagged) extras.push("⚑");
    return `◻️ ${prefix}${title}${extras.length ? ` · ${extras.join(" · ")}` : ""}`;
  }
  if (item.status === "rescheduled" && item.nextDue) {
    return `✅ <s>${title}</s> · 🔁 ${formatDayTitle(item.nextDue, date).toLowerCase()}`;
  }
  return `✅ <s>${title}</s>`;
}

/** Порядок внутри списка: невыполненные по сроку, затем выполненные */
function compareItems(a: DigestItem, b: DigestItem): number {
  if ((a.status === "open") !== (b.status === "open")) return a.status === "open" ? -1 : 1;
  const ad = a.dueDate ?? "9999";
  const bd = b.dueDate ?? "9999";
  if (ad !== bd) return ad < bd ? -1 : 1;
  const at = a.dueTime ?? "99:99";
  const bt = b.dueTime ?? "99:99";
  if (at !== bt) return at < bt ? -1 : 1;
  return b.priority - a.priority || a.id - b.id;
}

/**
 * Варианты сводки. Эмодзи в начале заголовка — ещё и метка варианта: по нему бот
 * понимает, как перерисовать сообщение после нажатия «✓» (см. variantOfMessage).
 */
export type DigestVariant = "morning" | "today" | "evening" | "tomorrow";

const VARIANTS: Record<
  DigestVariant,
  (day: string) => { header: string; empty: string; allDone: string; openLabel: string }
> = {
  morning: (day) => ({
    header: `☀️ <b>Доброе утро!</b>\n${day}`,
    empty: "На сегодня задач нет — свободный день.",
    allDone: "Всё сделано 🎉",
    openLabel: "Задач",
  }),
  today: (day) => ({
    header: `📋 <b>${day}</b>`,
    empty: "На сегодня задач нет — свободный день.",
    allDone: "Всё сделано 🎉",
    openLabel: "Задач",
  }),
  evening: (day) => ({
    header: `🌙 <b>Не выполнено сегодня</b>\n${day}`,
    empty: "Все задачи на сегодня выполнены 🎉",
    allDone: "Всё доделано 🎉",
    openLabel: "Осталось",
  }),
  tomorrow: (day) => ({
    header: `📅 <b>Задачи на завтра</b>\n${day}`,
    empty: "На завтра задач нет.",
    allDone: "Всё уже сделано 🎉",
    openLabel: "Задач",
  }),
};

const VARIANT_MARKS: Array<[string, DigestVariant]> = [
  ["☀️", "morning"],
  ["🌙", "evening"],
  ["📅", "tomorrow"],
];

/** Вариант сводки по тексту уже отправленного сообщения. */
export function variantOfMessage(text: string | undefined): DigestVariant {
  return VARIANT_MARKS.find(([mark]) => text?.startsWith(mark))?.[1] ?? "today";
}

export function buildDigest({
  date,
  items,
  lists,
  appUrl,
  variant,
}: {
  /** Дата сводки "YYYY-MM-DD" */
  date: string;
  items: DigestItem[];
  /** Списки в пользовательском порядке — для группировки */
  lists: Array<{ id: number; name: string }>;
  appUrl?: string | null;
  variant: DigestVariant;
}): BotMessage {
  const day = capitalize(formatDate(date, "EEEE, d MMMM"));
  const { header, empty, allDone, openLabel } = VARIANTS[variant](day);
  const appRow: InlineButton[][] = appUrl ? [[{ text: "Открыть AveTrack", url: appUrl }]] : [];

  if (items.length === 0) {
    return { text: `${header}\n\n${empty}`, keyboard: appRow };
  }

  const open = items.filter((i) => i.status === "open");
  const doneCount = items.length - open.length;
  const summary =
    open.length === 0
      ? allDone
      : `${openLabel}: ${open.length}${doneCount ? ` · выполнено: ${doneCount}` : ""}`;

  const blocks: string[] = [];
  let length = header.length + summary.length;
  let hidden = 0;
  for (const list of lists) {
    const group = items.filter((i) => i.listId === list.id).sort(compareItems);
    if (group.length === 0) continue;
    const lines = [`<b>${escapeHtml(list.name)}</b>`, ...group.map((i) => itemLine(i, date))];
    const block = lines.join("\n");
    if (length + block.length > MAX_TEXT) {
      hidden += group.length;
      continue;
    }
    length += block.length + 2;
    blocks.push(block);
  }
  if (hidden) blocks.push(`<i>…и ещё ${hidden} — в приложении</i>`);

  const sortedOpen = lists.flatMap((l) => open.filter((i) => i.listId === l.id).sort(compareItems));
  const keyboard: InlineButton[][] = sortedOpen.slice(0, MAX_BUTTONS).map((item) => [
    { text: `✓ ${truncate(item.title, BUTTON_TITLE)}`, callback_data: `done:${item.id}:${date}` },
  ]);

  return {
    text: `${header}\n${summary}\n\n${blocks.join("\n\n")}`,
    keyboard: [...keyboard, ...appRow],
  };
}

export function buildReminder(item: { id: number; title: string; notes: string | null; dueTime: string | null; priority: Priority }): BotMessage {
  const marks = PRIORITIES[item.priority]?.marks;
  const lines = [`⏰ <b>${item.dueTime ?? ""}</b> · ${marks ? `<b>${marks}</b> ` : ""}${escapeHtml(item.title)}`];
  if (item.notes) lines.push(`<i>${escapeHtml(truncate(item.notes, 300))}</i>`);
  return { text: lines.join("\n"), keyboard: [[{ text: "✓ Выполнено", callback_data: `rdone:${item.id}` }]] };
}

/** Текст напоминания после нажатия «Выполнено» */
export function reminderDoneText(title: string, nextDue: string | null, today: string): string {
  const base = `✅ <s>${escapeHtml(title)}</s>`;
  return nextDue ? `${base}\n🔁 Следующий раз: ${formatDayTitle(nextDue, today).toLowerCase()}` : base;
}

export const HELP_TEXT = [
  "<b>AveTrack</b> — задачи и напоминания.",
  "",
  "/today — задачи на сегодня и просроченные",
  "/tomorrow — задачи на завтра",
  "/money — доходы за месяц",
  "/add <i>текст</i> — добавить задачу во «Входящие» на сегодня",
  "",
  "Утром пришлю сводку на день, вечером — что осталось, планы на завтра и доходы за месяц.",
  "Задачи со временем напомню отдельно.",
].join("\n");

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ───────────── отчёт по доходам ─────────────

/** Статистика доходов за текущий месяц: итог, среднее, сравнение с прошлым месяцем, источники, цели. */
export function buildMoneyReport({
  today,
  entries,
  goals,
  currency,
  appUrl,
}: {
  today: string;
  entries: MoneyEntryItem[];
  goals: GoalItem[];
  currency: string;
  appUrl?: string | null;
}): BotMessage {
  const money = (cents: number) => formatMoney(cents, currency);
  const d = parseISO(today);
  const monthName = format(d, "LLLL", { locale: ru });
  const prev = subMonths(d, 1);
  const prevName = capitalize(format(prev, "LLLL", { locale: ru }));

  const month = periodRange("month", today);
  const monthEntries = entries.filter((e) => inRange(e.date, month));
  const total = sumInRange(monthEntries, month);
  // Прошлый месяц с 1-го по тот же день (subMonths прижимает 31-е к концу короткого месяца)
  const prevToDate = { from: format(startOfMonth(prev), "yyyy-MM-dd"), to: format(prev, "yyyy-MM-dd") };
  const prevTotal = sumInRange(entries, prevToDate);
  const keyboard: InlineButton[][] = appUrl ? [[{ text: "Открыть «Деньги»", url: `${appUrl}/money` }]] : [];

  const lines = [`💰 <b>Доходы за ${monthName}</b>`];

  if (monthEntries.length === 0) {
    lines.push("", "В этом месяце доходов пока нет.");
    if (prevTotal > 0) lines.push(`${prevName} к этому дню: ${money(prevTotal)}`);
    return { text: lines.join("\n"), keyboard };
  }

  const count = monthEntries.length;
  lines.push(`<b>${money(total)}</b> · ${count} ${plural(count, ["запись", "записи", "записей"])}`);
  const todayTotal = sumInRange(monthEntries, { from: today, to: today });
  if (todayTotal > 0) lines.push(`Сегодня: +${money(todayTotal)}`);
  lines.push(`В среднем в день: ${money(Math.round(total / d.getDate()))}`);
  if (prevTotal > 0) {
    const change = Math.round(((total - prevTotal) / prevTotal) * 100);
    const arrow = change > 0 ? `↑ ${change}%` : change < 0 ? `↓ ${Math.abs(change)}%` : "без изменений";
    lines.push(`${prevName} к этому дню: ${money(prevTotal)} (${arrow})`);
  }

  // Источники — по комментарию записи
  const bySource = new Map<string, number>();
  for (const e of monthEntries) {
    const key = e.note?.trim() || "Без комментария";
    bySource.set(key, (bySource.get(key) ?? 0) + e.amountCents);
  }
  const sources = [...bySource.entries()].sort((a, b) => b[1] - a[1]);
  const top = sources.slice(0, 5);
  const rest = sources.slice(5).reduce((sum, [, cents]) => sum + cents, 0);
  if (rest > 0) top.push(["Другое", rest]);
  lines.push("", "<b>Источники</b>");
  for (const [name, cents] of top) {
    lines.push(`• ${escapeHtml(truncate(name, 40))} — ${money(cents)} (${Math.round((cents / total) * 100)}%)`);
  }

  const active = goals
    .map((goal) => ({ goal, progress: goalProgress(goal, entries, today) }))
    .filter(({ progress }) => !progress.expired)
    .slice(0, 5);
  if (active.length) {
    lines.push("", "<b>Цели</b>");
    for (const { goal, progress } of active) {
      const status = progress.achieved
        ? "✅ достигнута"
        : `ещё ${formatMoney(progress.remainingCents, currency, { compact: true })}`;
      lines.push(`• ${escapeHtml(truncate(goal.title, 40))} — ${progress.percent}% · ${status}`);
    }
  }

  return { text: lines.join("\n"), keyboard };
}
