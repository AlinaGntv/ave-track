// Чистая логика задач: без БД и UI, используется и на сервере, и на клиенте.
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { nextDueAfterCompletion } from "@/features/recurrence/next";
import { normalizeRecurrence, type Recurrence } from "@/features/recurrence/rule";

export type Priority = 0 | 1 | 2 | 3;

export const PRIORITIES: Array<{ value: Priority; label: string; marks: string }> = [
  { value: 0, label: "Нет", marks: "" },
  { value: 1, label: "Низкий", marks: "!" },
  { value: 2, label: "Средний", marks: "!!" },
  { value: 3, label: "Высокий", marks: "!!!" },
];

export type SubtaskItem = { id: number; title: string; completedAt: number | null };

/** Задача верхнего уровня в том виде, в каком её видит UI. */
export type TaskItem = {
  id: number;
  listId: number;
  title: string;
  notes: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: Priority;
  flagged: boolean;
  completedAt: number | null;
  recurrence: Recurrence | null;
  /** Сколько раз выполнялась (история task_completions) — для «после N повторений» */
  completionCount: number;
  lastCompletedAt: number | null;
  sortOrder: number;
  subtasks: SubtaskItem[];
};

/** Состояние формы редактирования задачи. */
export type TaskDraft = {
  title: string;
  notes: string;
  listId: number;
  dueDate: string | null;
  dueTime: string | null;
  priority: Priority;
  flagged: boolean;
  recurrence: Recurrence | null;
  /** key — стабильный клиентский ключ для ещё не сохранённых подзадач */
  subtasks: Array<{ id?: number; key?: string; title: string; done: boolean }>;
};

export const SMART_LISTS = ["today", "scheduled", "all", "flagged", "completed"] as const;
export type SmartListKind = (typeof SMART_LISTS)[number];

export function isSmartListKind(value: string): value is SmartListKind {
  return (SMART_LISTS as readonly string[]).includes(value);
}

export type TaskView = { type: "smart"; kind: SmartListKind } | { type: "list"; listId: number };

// ───────────── фильтры ─────────────

export function isDone(task: Pick<TaskItem, "completedAt">): boolean {
  return task.completedAt != null;
}

export function isOverdue(task: Pick<TaskItem, "completedAt" | "dueDate">, today: string): boolean {
  return !isDone(task) && task.dueDate != null && task.dueDate < today;
}

export function matchesView(
  task: TaskItem,
  view: TaskView,
  today: string,
  showCompleted = false,
): boolean {
  const done = isDone(task);
  if (view.type === "list") return task.listId === view.listId && (showCompleted || !done);
  switch (view.kind) {
    case "today":
      return !done && task.dueDate != null && task.dueDate <= today;
    case "scheduled":
      return !done && task.dueDate != null;
    case "all":
      return !done;
    case "flagged":
      return !done && task.flagged;
    case "completed":
      return done;
  }
}

export type SmartCounts = Record<Exclude<SmartListKind, "completed">, number>;

export function countSmartLists(tasks: TaskItem[], today: string): SmartCounts {
  const counts: SmartCounts = { today: 0, scheduled: 0, all: 0, flagged: 0 };
  for (const task of tasks) {
    for (const kind of Object.keys(counts) as Array<keyof SmartCounts>) {
      if (matchesView(task, { type: "smart", kind }, today)) counts[kind]++;
    }
  }
  return counts;
}

// ───────────── сортировка и группировка ─────────────

/** Дата → время (без времени в конце дня) → приоритет → ручной порядок. Без даты — в конце. */
export function compareByDue(a: TaskItem, b: TaskItem): number {
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  if (a.dueTime !== b.dueTime) {
    if (!a.dueTime) return 1;
    if (!b.dueTime) return -1;
    return a.dueTime < b.dueTime ? -1 : 1;
  }
  if (a.priority !== b.priority) return b.priority - a.priority;
  return compareManual(a, b);
}

export function compareManual(a: TaskItem, b: TaskItem): number {
  return a.sortOrder - b.sortOrder || Math.abs(a.id) - Math.abs(b.id);
}

export function sortForView(tasks: TaskItem[], view: TaskView): TaskItem[] {
  const copy = [...tasks];
  // Списки и «Все» (сгруппированы по спискам) — в ручном порядке, как в Reminders
  if (view.type === "list" || view.kind === "all") {
    return copy.sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || compareManual(a, b));
  }
  if (view.kind === "completed") {
    return copy.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  }
  return copy.sort(compareByDue);
}

export type TaskGroup = { key: string; title: string | null; tasks: TaskItem[] };

/** Группы для отображения; tasks должны быть уже отсортированы sortForView. */
export function groupForView(
  tasks: TaskItem[],
  view: TaskView,
  today: string,
  lists: Array<{ id: number; name: string }> = [],
): TaskGroup[] {
  if (view.type === "smart" && (view.kind === "today" || view.kind === "scheduled")) {
    const overdue = tasks.filter((t) => isOverdue(t, today));
    const rest = tasks.filter((t) => !isOverdue(t, today));
    const groups: TaskGroup[] = [];
    if (overdue.length) groups.push({ key: "overdue", title: "Просрочено", tasks: overdue });
    if (view.kind === "today") {
      if (rest.length) groups.push({ key: "today", title: overdue.length ? "Сегодня" : null, tasks: rest });
      return groups;
    }
    const byDate = new Map<string, TaskItem[]>();
    for (const task of rest) {
      const key = task.dueDate!;
      byDate.set(key, [...(byDate.get(key) ?? []), task]);
    }
    for (const [date, items] of byDate) {
      groups.push({ key: date, title: formatDayTitle(date, today), tasks: items });
    }
    return groups;
  }

  if (view.type === "smart" && view.kind === "all") {
    return lists
      .map((list) => ({
        key: `list-${list.id}`,
        title: list.name,
        tasks: tasks.filter((t) => t.listId === list.id),
      }))
      .filter((g) => g.tasks.length > 0);
  }

  return tasks.length ? [{ key: "all", title: null, tasks }] : [];
}

// ───────────── подписи дат ─────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function relativeDay(date: string, today: string): string | null {
  const diff = differenceInCalendarDays(parseISO(date), parseISO(today));
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Завтра";
  if (diff === -1) return "Вчера";
  return null;
}

/** Заголовок группы: «Сегодня», «Завтра», «Пн, 20 октября», «3 января 2027». */
export function formatDayTitle(date: string, today: string): string {
  const rel = relativeDay(date, today);
  if (rel) return rel;
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return capitalize(format(parseISO(date), sameYear ? "EEEEEE, d MMMM" : "d MMMM yyyy", { locale: ru }));
}

/** Короткая подпись срока в строке задачи: «Завтра, 09:30», «20 окт.». */
export function formatDueLabel(dueDate: string | null, dueTime: string | null, today: string): string | null {
  if (!dueDate) return null;
  const sameYear = dueDate.slice(0, 4) === today.slice(0, 4);
  const day =
    relativeDay(dueDate, today) ??
    format(parseISO(dueDate), sameYear ? "d MMM" : "d MMM yyyy", { locale: ru });
  return dueTime ? `${day}, ${dueTime}` : day;
}

// ───────────── черновики ─────────────

export function emptyDraft(listId: number): TaskDraft {
  return {
    title: "",
    notes: "",
    listId,
    dueDate: null,
    dueTime: null,
    priority: 0,
    flagged: false,
    recurrence: null,
    subtasks: [],
  };
}

/** Значения по умолчанию для новой задачи, созданной из конкретного экрана. */
export function defaultsForView(view: TaskView, today: string): Partial<TaskDraft> {
  if (view.type === "list") return { listId: view.listId };
  switch (view.kind) {
    case "today":
    case "scheduled":
      return { dueDate: today };
    case "flagged":
      return { flagged: true };
    default:
      return {};
  }
}

export function draftFromTask(task: TaskItem): TaskDraft {
  return {
    title: task.title,
    notes: task.notes ?? "",
    listId: task.listId,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    priority: task.priority,
    flagged: task.flagged,
    recurrence: task.recurrence,
    subtasks: task.subtasks.map((s) => ({ id: s.id, title: s.title, done: s.completedAt != null })),
  };
}

/**
 * Нормализация перед сохранением: обрезка пробелов, пустые подзадачи выкидываются,
 * время и повтор без даты сбрасываются (повтор отсчитывается от даты задачи).
 */
export function cleanDraft(draft: TaskDraft): TaskDraft {
  return {
    ...draft,
    title: draft.title.trim(),
    notes: draft.notes.trim(),
    dueTime: draft.dueDate ? draft.dueTime : null,
    recurrence: draft.dueDate && draft.recurrence ? normalizeRecurrence(draft.recurrence) : null,
    subtasks: draft.subtasks
      .map((s) => ({ ...s, title: s.title.trim() }))
      .filter((s) => s.title.length > 0),
  };
}

let tempId = 0;
/** Временный отрицательный id для оптимистично созданных записей. */
export function nextTempId(): number {
  tempId -= 1;
  return tempId;
}

/** Оптимистичное представление задачи до ответа сервера. */
export function taskFromDraft(draft: TaskDraft, existing?: TaskItem): TaskItem {
  const now = Date.now();
  return {
    id: existing?.id ?? nextTempId(),
    listId: draft.listId,
    title: draft.title,
    notes: draft.notes || null,
    dueDate: draft.dueDate,
    dueTime: draft.dueDate ? draft.dueTime : null,
    priority: draft.priority,
    flagged: draft.flagged,
    completedAt: existing?.completedAt ?? null,
    recurrence: draft.dueDate ? draft.recurrence : null,
    completionCount: existing?.completionCount ?? 0,
    lastCompletedAt: existing?.lastCompletedAt ?? null,
    sortOrder:
      existing && existing.listId === draft.listId ? existing.sortOrder : Number.MAX_SAFE_INTEGER,
    subtasks: draft.subtasks.map((s) => {
      const prev = existing?.subtasks.find((p) => p.id === s.id);
      return {
        id: s.id ?? nextTempId(),
        title: s.title,
        completedAt: s.done ? (prev?.completedAt ?? now) : null,
      };
    }),
  };
}

// ───────────── выполнение ─────────────

export type CompletionOutcome =
  | { type: "completed" }
  | { type: "rescheduled"; nextDue: string; prevDue: string };

/**
 * Что происходит при отметке выполнения: обычная задача закрывается,
 * повторяющаяся переносится на следующую дату, пока серия не закончилась.
 */
export function completionOutcome(task: TaskItem, today: string): CompletionOutcome {
  if (!task.recurrence || !task.dueDate) return { type: "completed" };
  const nextDue = nextDueAfterCompletion(task.recurrence, task.dueDate, today, task.completionCount + 1);
  return nextDue ? { type: "rescheduled", nextDue, prevDue: task.dueDate } : { type: "completed" };
}

/** Состояние задачи после выполнения — общее для оптимистичного UI и сервера. */
export function applyCompletion(task: TaskItem, outcome: CompletionOutcome, now = Date.now()): TaskItem {
  const base = { ...task, completionCount: task.completionCount + 1, lastCompletedAt: now };
  if (outcome.type === "completed") return { ...base, completedAt: now };
  // Новое вхождение начинается с чистого листа: подзадачи сбрасываются
  return {
    ...base,
    dueDate: outcome.nextDue,
    subtasks: task.subtasks.map((s) => ({ ...s, completedAt: null })),
  };
}
