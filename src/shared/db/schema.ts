import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Даты задач и денег хранятся как локальные строки в часовом поясе из настроек:
 *   date — "YYYY-MM-DD", time — "HH:mm".
 * Метки времени событий (created_at, completed_at…) — UTC в миллисекундах.
 */

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const lists = sqliteTable("lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("list"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listId: integer("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    parentId: integer("parent_id").references((): AnySQLiteColumn => tasks.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    notes: text("notes"),
    dueDate: text("due_date"),
    dueTime: text("due_time"),
    /** 0 — нет, 1 — низкий, 2 — средний, 3 — высокий */
    priority: integer("priority").notNull().default(0),
    flagged: integer("flagged", { mode: "boolean" }).notNull().default(false),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    /** JSON-правило повтора, см. features/recurrence */
    recurrence: text("recurrence"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("tasks_list_idx").on(t.listId),
    index("tasks_parent_idx").on(t.parentId),
    index("tasks_due_idx").on(t.dueDate),
    index("tasks_completed_idx").on(t.completedAt),
  ],
);

export const taskCompletions = sqliteTable(
  "task_completions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    /** За какое вхождение повтора выполнено */
    dueDate: text("due_date"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("completions_task_idx").on(t.taskId)],
);

export const moneyEntries = sqliteTable(
  "money_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    amountCents: integer("amount_cents").notNull(),
    date: text("date").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("money_date_idx").on(t.date)],
);

export const moneyGoals = sqliteTable("money_goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  targetCents: integer("target_cents").notNull(),
  /** "month" | "year" — повторяющаяся цель по текущему периоду; null — по start/end */
  period: text("period"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  createdAt: createdAt(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  /** JSON-значение */
  value: text("value").notNull(),
});

export const sentNotifications = sqliteTable(
  "sent_notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** "digest" | "reminder" */
    kind: text("kind").notNull(),
    /** 0 для утренней рассылки */
    taskId: integer("task_id").notNull().default(0),
    /** "YYYY-MM-DD" или "YYYY-MM-DDTHH:mm" */
    sentFor: text("sent_for").notNull(),
    sentAt: createdAt(),
  },
  (t) => [uniqueIndex("sent_unique").on(t.kind, t.taskId, t.sentFor)],
);

export type List = typeof lists.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type MoneyEntry = typeof moneyEntries.$inferSelect;
export type MoneyGoal = typeof moneyGoals.$inferSelect;
