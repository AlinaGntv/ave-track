import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  real,
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
    /** Длительность в минутах (для календаря); null — по умолчанию час */
    durationMinutes: integer("duration_minutes"),
    /** 0 — нет, 1 — низкий, 2 — средний, 3 — высокий */
    priority: integer("priority").notNull().default(0),
    flagged: integer("flagged", { mode: "boolean" }).notNull().default(false),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    /** JSON-правило повтора, см. features/recurrence */
    recurrence: text("recurrence"),
    /** Ранние напоминания — JSON-массив вида ["1m","2w","1w"], см. features/tasks/early */
    earlyReminders: text("early_reminders"),
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
    dueTime: text("due_time"),
    durationMinutes: integer("duration_minutes"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("completions_task_idx").on(t.taskId)],
);

/** Отдельные временные отрезки задачи для конкретного календарного дня. */
export const taskCalendarSegments = sqliteTable(
  "task_calendar_segments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    startTime: text("start_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("task_calendar_segments_day_idx").on(t.date, t.taskId)],
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

export const timeEntries = sqliteTable(
  "time_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    /** Продолжительность в миллисекундах — как в исходном localStorage. */
    durationMs: integer("duration_ms").notNull(),
    /** Время окончания для таймера, выбранные дата/время для ручных записей. */
    date: integer("date", { mode: "timestamp_ms" }).notNull(),
    /** ID исходной записи для повторно-безопасного импорта. */
    sourceId: text("source_id"),
  },
  (t) => [index("time_entries_date_idx").on(t.date), uniqueIndex("time_entries_source_idx").on(t.sourceId)],
);

/** Один активный таймер на весь личный аккаунт. */
export const timeTrackerSession = sqliteTable("time_tracker_session", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
});

/** Независимые спортивные цели и программы (зал, коньки и другие активности). */
export const sportProfiles = sqliteTable("sport_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  activity: text("activity").notNull(),
  heightCm: real("height_cm"),
  targetWeightKg: real("target_weight_kg"),
  targetWaistCm: real("target_waist_cm"),
  targetHipsCm: real("target_hips_cm"),
  workoutIntervalDays: integer("workout_interval_days").notNull().default(2),
  createdAt: createdAt(),
});

export const sportExercises = sqliteTable(
  "sport_exercises",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    profileId: integer("profile_id").notNull().references(() => sportProfiles.id, { onDelete: "cascade" }),
    dayLabel: text("day_label").notNull().default("A"),
    title: text("title").notNull(),
    sets: integer("sets").notNull().default(3),
    reps: integer("reps").notNull().default(10),
    unit: text("unit").notNull().default("повторов"),
    weightKg: real("weight_kg"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("sport_exercises_profile_day_idx").on(t.profileId, t.dayLabel, t.sortOrder)],
);

export const sportWorkouts = sqliteTable(
  "sport_workouts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    profileId: integer("profile_id").notNull().references(() => sportProfiles.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    dayLabel: text("day_label").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("sport_workouts_profile_date_idx").on(t.profileId, t.date)],
);

export const sportWorkoutExercises = sqliteTable(
  "sport_workout_exercises",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workoutId: integer("workout_id").notNull().references(() => sportWorkouts.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id").references(() => sportExercises.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    targetSets: integer("target_sets").notNull(),
    targetReps: integer("target_reps").notNull(),
    targetUnit: text("target_unit").notNull().default("повторов"),
    targetWeightKg: real("target_weight_kg"),
    actualReps: integer("actual_reps"),
    actualWeightKg: real("actual_weight_kg"),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("sport_workout_exercises_workout_idx").on(t.workoutId)],
);

export const sportActivityDays = sqliteTable(
  "sport_activity_days",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    profileId: integer("profile_id").notNull().references(() => sportProfiles.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sport_activity_day_unique").on(t.profileId, t.date)],
);

export const sportMeasurements = sqliteTable(
  "sport_measurements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    profileId: integer("profile_id").notNull().references(() => sportProfiles.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    weightKg: real("weight_kg"),
    chestCm: real("chest_cm"),
    waistCm: real("waist_cm"),
    hipsCm: real("hips_cm"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sport_measurements_profile_date_unique").on(t.profileId, t.date)],
);

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
