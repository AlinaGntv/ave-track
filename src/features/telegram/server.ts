import { fromZonedTime } from "date-fns-tz";
import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { getDb, schema } from "@/shared/db/client";
import { shiftDate } from "@/shared/lib/dates";
import { getOpenTasks } from "@/features/tasks/server";
import type { TaskItem } from "@/features/tasks/model";
import type { DigestItem } from "./format";
import { isReminderDue } from "./schedule";

const t = schema.tasks;
const c = schema.taskCompletions;
const n = schema.sentNotifications;

function toItem(task: TaskItem, status: DigestItem["status"], extra: Partial<DigestItem> = {}): DigestItem {
  return {
    id: task.id,
    title: task.title,
    listId: task.listId,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    priority: task.priority,
    flagged: task.flagged,
    recurring: task.recurrence != null,
    status,
    ...extra,
  };
}

/**
 * Содержимое сводки за дату: невыполненные задачи со сроком ≤ даты (включая просроченные)
 * и задачи, выполненные в этот день, — чтобы после нажатия «✓» сообщение можно было
 * перерисовать с зачёркнутыми пунктами.
 *
 * - exact: только задачи ровно на эту дату (сводка «на завтра»);
 * - completedSince: показывать выполненные не за весь день, а начиная с этого момента —
 *   для вечерних сообщений, где важно только то, что не было сделано к моменту отправки.
 */
export function getDigestItems(
  date: string,
  timezone: string,
  options: { exact?: boolean; completedSince?: Date } = {},
): DigestItem[] {
  const matchesDate = (due: string | null) => due != null && (options.exact ? due === date : due <= date);
  const open = getOpenTasks().filter((task) => matchesDate(task.dueDate));
  const items = open.map((task) => toItem(task, "open"));
  const seen = new Set(items.map((i) => i.id));

  // Выполненные в этот день по локальному времени (или после отправки сообщения)
  const from = options.completedSince ?? fromZonedTime(`${date}T00:00:00`, timezone);
  const to = options.completedSince ? null : fromZonedTime(`${shiftDate(date, 1)}T00:00:00`, timezone);
  const db = getDb();
  const completions = db
    .select({ taskId: c.taskId, dueDate: c.dueDate })
    .from(c)
    .where(and(gte(c.completedAt, from), to ? lt(c.completedAt, to) : undefined))
    .all()
    .filter((row) => matchesDate(row.dueDate) && !seen.has(row.taskId));
  if (completions.length === 0) return items;

  const rows = db
    .select()
    .from(t)
    .where(and(inArray(t.id, [...new Set(completions.map((r) => r.taskId))]), isNull(t.parentId)))
    .all();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const done = row.completedAt != null;
    items.push({
      id: row.id,
      title: row.title,
      listId: row.listId,
      dueDate: completions.find((r) => r.taskId === row.id)?.dueDate ?? row.dueDate,
      dueTime: row.dueTime,
      priority: row.priority as DigestItem["priority"],
      flagged: row.flagged,
      recurring: row.recurrence != null,
      status: done ? "done" : "rescheduled",
      nextDue: done ? null : row.dueDate,
    });
  }
  return items;
}

/** Задачи со временем на сегодня, о которых пора напомнить. */
export function getDueReminders(today: string, now: string): TaskItem[] {
  return getOpenTasks().filter(
    (task) => task.dueDate === today && task.dueTime != null && isReminderDue(task.dueTime, now),
  );
}

/**
 * Атомарно «бронирует» отправку: вставка с уникальным ключом (kind, task_id, sent_for).
 * Возвращает id брони или null, если такое уведомление уже отправлялось —
 * так перезапуск worker'а (или второй экземпляр) не пришлёт дубль.
 */
export function claimNotification(kind: string, taskId: number, sentFor: string): number | null {
  const row = getDb()
    .insert(n)
    .values({ kind, taskId, sentFor })
    .onConflictDoNothing()
    .returning({ id: n.id })
    .get();
  return row?.id ?? null;
}

/** Снять бронь, если отправка не удалась, — попробуем снова на следующей минуте. */
export function releaseNotification(id: number): void {
  getDb().delete(n).where(eq(n.id, id)).run();
}

export function cleanupNotifications(olderThanDays = 30): void {
  const border = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  getDb().delete(n).where(lt(n.sentAt, border)).run();
}
