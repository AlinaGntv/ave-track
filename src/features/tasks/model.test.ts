import { describe, expect, it } from "vitest";
import {
  applyCompletion,
  cleanDraft,
  completionOutcome,
  countSmartLists,
  defaultsForView,
  emptyDraft,
  formatDayTitle,
  formatDueLabel,
  groupForView,
  matchesView,
  sortForView,
  taskFromDraft,
  type TaskItem,
} from "./model";

const TODAY = "2026-10-17";

let seq = 0;
function task(patch: Partial<TaskItem> = {}): TaskItem {
  seq++;
  return {
    id: seq,
    listId: 1,
    title: `Задача ${seq}`,
    notes: null,
    dueDate: null,
    dueTime: null,
    priority: 0,
    flagged: false,
    completedAt: null,
    recurrence: null,
    completionCount: 0,
    lastCompletedAt: null,
    sortOrder: seq,
    subtasks: [],
    ...patch,
  };
}

describe("умные списки", () => {
  const overdue = task({ dueDate: "2026-10-15" });
  const today = task({ dueDate: TODAY, dueTime: "09:00" });
  const tomorrow = task({ dueDate: "2026-10-18", flagged: true });
  const noDate = task({ listId: 2 });
  const done = task({ dueDate: TODAY, completedAt: 1 });
  const all = [overdue, today, tomorrow, noDate, done];

  const ids = (kind: Parameters<typeof matchesView>[1]) =>
    all.filter((t) => matchesView(t, kind, TODAY)).map((t) => t.id);

  it("Сегодня включает просроченные, но не выполненные и не будущие", () => {
    expect(ids({ type: "smart", kind: "today" })).toEqual([overdue.id, today.id]);
  });

  it("Запланированные — все невыполненные с датой", () => {
    expect(ids({ type: "smart", kind: "scheduled" })).toEqual([overdue.id, today.id, tomorrow.id]);
  });

  it("Все, С флажком, Выполненные", () => {
    expect(ids({ type: "smart", kind: "all" })).toHaveLength(4);
    expect(ids({ type: "smart", kind: "flagged" })).toEqual([tomorrow.id]);
    expect(ids({ type: "smart", kind: "completed" })).toEqual([done.id]);
  });

  it("пользовательский список скрывает выполненные, пока их не попросят", () => {
    const view = { type: "list", listId: 1 } as const;
    expect(all.filter((t) => matchesView(t, view, TODAY))).toHaveLength(3);
    expect(all.filter((t) => matchesView(t, view, TODAY, true))).toHaveLength(4);
  });

  it("счётчики совпадают с фильтрами", () => {
    expect(countSmartLists(all, TODAY)).toEqual({ today: 2, scheduled: 3, all: 4, flagged: 1 });
  });
});

describe("сортировка и группировка", () => {
  it("по сроку: дата → время → без времени → приоритет", () => {
    const a = task({ dueDate: TODAY });
    const b = task({ dueDate: TODAY, dueTime: "08:00" });
    const c = task({ dueDate: TODAY, dueTime: "07:00" });
    const d = task({ dueDate: "2026-10-01" });
    const e = task({ dueDate: TODAY, priority: 3 });
    const sorted = sortForView([a, b, c, d, e], { type: "smart", kind: "scheduled" });
    expect(sorted.map((t) => t.id)).toEqual([d.id, c.id, b.id, e.id, a.id]);
  });

  it("в списке выполненные уходят вниз", () => {
    const a = task({ completedAt: 5 });
    const b = task();
    expect(sortForView([a, b], { type: "list", listId: 1 })[0]!.id).toBe(b.id);
  });

  it("Запланированные группируются по дням, просроченные — отдельно", () => {
    const view = { type: "smart", kind: "scheduled" } as const;
    const tasks = sortForView(
      [task({ dueDate: "2026-10-18" }), task({ dueDate: "2026-10-10" }), task({ dueDate: "2026-10-18" })],
      view,
    );
    const groups = groupForView(tasks, view, TODAY);
    expect(groups.map((g) => [g.title, g.tasks.length])).toEqual([
      ["Просрочено", 1],
      ["Завтра", 2],
    ]);
  });

  it("Все группируются по спискам в их порядке", () => {
    const view = { type: "smart", kind: "all" } as const;
    const groups = groupForView([task({ listId: 2 }), task({ listId: 1 })], view, TODAY, [
      { id: 1, name: "Входящие" },
      { id: 2, name: "Работа" },
    ]);
    expect(groups.map((g) => g.title)).toEqual(["Входящие", "Работа"]);
  });
});

describe("подписи дат", () => {
  it("относительные дни", () => {
    expect(formatDueLabel(TODAY, null, TODAY)).toBe("Сегодня");
    expect(formatDueLabel("2026-10-18", "09:30", TODAY)).toBe("Завтра, 09:30");
    expect(formatDueLabel("2026-10-16", null, TODAY)).toBe("Вчера");
    expect(formatDueLabel(null, null, TODAY)).toBeNull();
  });

  it("другие дни и годы", () => {
    expect(formatDueLabel("2026-10-20", null, TODAY)).toBe("20 окт.");
    expect(formatDayTitle("2026-10-20", TODAY)).toBe("Вт, 20 октября");
    expect(formatDayTitle("2027-01-03", TODAY)).toBe("3 января 2027");
  });
});

describe("черновики", () => {
  it("cleanDraft обрезает пробелы, убирает пустые подзадачи и время без даты", () => {
    const draft = cleanDraft({
      ...emptyDraft(1),
      title: "  Купить хлеб ",
      dueTime: "10:00",
      subtasks: [{ title: " ", done: false }, { title: " молоко ", done: true }],
    });
    expect(draft.title).toBe("Купить хлеб");
    expect(draft.dueTime).toBeNull();
    expect(draft.subtasks).toEqual([{ title: "молоко", done: true }]);
  });

  it("defaultsForView подставляет контекст экрана", () => {
    expect(defaultsForView({ type: "smart", kind: "today" }, TODAY)).toEqual({ dueDate: TODAY });
    expect(defaultsForView({ type: "smart", kind: "flagged" }, TODAY)).toEqual({ flagged: true });
    expect(defaultsForView({ type: "list", listId: 7 }, TODAY)).toEqual({ listId: 7 });
  });

  it("новая задача получает временный отрицательный id и встаёт в конец", () => {
    const t = taskFromDraft({ ...emptyDraft(1), title: "x" });
    expect(t.id).toBeLessThan(0);
    expect(t.sortOrder).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe("выполнение", () => {
  const daily = { freq: "day", interval: 1, end: { type: "never" } } as const;

  it("обычная задача закрывается", () => {
    const t = task({ dueDate: TODAY });
    const outcome = completionOutcome(t, TODAY);
    expect(outcome).toEqual({ type: "completed" });
    const next = applyCompletion(t, outcome, 123);
    expect(next.completedAt).toBe(123);
    expect(next.completionCount).toBe(1);
  });

  it("повторяющаяся переносится, подзадачи сбрасываются", () => {
    const t = task({
      dueDate: TODAY,
      recurrence: daily,
      subtasks: [{ id: 100, title: "шаг", completedAt: 5 }],
    });
    const outcome = completionOutcome(t, TODAY);
    expect(outcome).toEqual({ type: "rescheduled", nextDue: "2026-10-18", prevDue: TODAY });
    const next = applyCompletion(t, outcome);
    expect(next.completedAt).toBeNull();
    expect(next.dueDate).toBe("2026-10-18");
    expect(next.subtasks[0]!.completedAt).toBeNull();
  });

  it("последнее повторение серии закрывает задачу", () => {
    const t = task({
      dueDate: TODAY,
      recurrence: { ...daily, end: { type: "count", count: 3 } },
      completionCount: 2,
    });
    expect(completionOutcome(t, TODAY)).toEqual({ type: "completed" });
  });

  it("повтор без даты сбрасывается при сохранении", () => {
    expect(cleanDraft({ ...emptyDraft(1), title: "x", recurrence: daily }).recurrence).toBeNull();
  });
});
