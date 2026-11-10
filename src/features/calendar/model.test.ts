import { describe, expect, it } from "vitest";
import type { TaskItem } from "@/features/tasks/model";
import {
  buildCalendar,
  layoutTimed,
  occurrencesInRange,
  rangeTitle,
  shiftAnchor,
  timeAtOffset,
  visibleDays,
} from "./model";

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
    durationMinutes: null,
    priority: 0,
    flagged: false,
    completedAt: null,
    recurrence: null,
    earlyReminders: [],
    completionCount: 0,
    lastCompletedAt: null,
    sortOrder: seq,
    subtasks: [],
    ...patch,
  };
}

describe("видимые дни и навигация", () => {
  it("неделя — с понедельника, «3 дня» и «день» — от опорной даты", () => {
    // 11 ноября 2026 — среда
    expect(visibleDays("2026-11-11", "week")).toEqual([
      "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15",
    ]);
    expect(visibleDays("2026-11-11", "3days")).toEqual(["2026-11-11", "2026-11-12", "2026-11-13"]);
    expect(visibleDays("2026-11-11", "day")).toEqual(["2026-11-11"]);
  });

  it("листание на неделю, 3 дня, день", () => {
    expect(shiftAnchor("2026-11-11", "week", 1)).toBe("2026-11-18");
    expect(shiftAnchor("2026-11-11", "3days", -1)).toBe("2026-11-08");
    expect(shiftAnchor("2026-11-30", "day", 1)).toBe("2026-12-01");
  });

  it("заголовок диапазона", () => {
    expect(rangeTitle(visibleDays("2026-11-11", "week"))).toBe("Ноябрь 2026");
    expect(rangeTitle(visibleDays("2026-12-02", "week"))).toBe("30 нояб. – 6 дек.");
  });

  it("время по месту тапа — с шагом 30 минут", () => {
    expect(timeAtOffset(0, 48)).toBe("00:00");
    expect(timeAtOffset(48 * 9 + 30, 48)).toBe("09:30");
    expect(timeAtOffset(48 * 9 + 10, 48)).toBe("09:00");
    expect(timeAtOffset(48 * 30, 48)).toBe("23:30"); // за пределами — последний слот
  });
});

describe("вхождения задач", () => {
  it("обычная задача — только её дата", () => {
    expect(occurrencesInRange(task({ dueDate: "2026-11-12" }), "2026-11-09", "2026-11-15")).toEqual([
      { date: "2026-11-12", projected: false },
    ]);
    expect(occurrencesInRange(task({ dueDate: "2026-11-20" }), "2026-11-09", "2026-11-15")).toEqual([]);
  });

  it("повторяющаяся — будущие вхождения отмечены как projected", () => {
    const daily = task({ dueDate: "2026-11-13", recurrence: { freq: "day", interval: 1, end: { type: "never" } } });
    expect(occurrencesInRange(daily, "2026-11-09", "2026-11-15")).toEqual([
      { date: "2026-11-13", projected: false },
      { date: "2026-11-14", projected: true },
      { date: "2026-11-15", projected: true },
    ]);
  });

  it("день рождения раз в год виден в следующем году", () => {
    const birthday = task({ dueDate: "2026-11-17", recurrence: { freq: "year", interval: 1, end: { type: "never" } } });
    expect(occurrencesInRange(birthday, "2027-11-15", "2027-11-21")).toEqual([{ date: "2027-11-17", projected: true }]);
  });

  it("окончание повтора: «N раз» с учётом уже выполненных и «до даты»", () => {
    const counted = task({
      dueDate: "2026-11-10",
      completionCount: 1, // выполнено 1 из 3 → осталось текущее и ещё одно
      recurrence: { freq: "day", interval: 1, end: { type: "count", count: 3 } },
    });
    expect(occurrencesInRange(counted, "2026-11-09", "2026-11-15").map((o) => o.date)).toEqual(["2026-11-10", "2026-11-11"]);
    const until = task({ dueDate: "2026-11-10", recurrence: { freq: "day", interval: 1, end: { type: "until", date: "2026-11-12" } } });
    expect(occurrencesInRange(until, "2026-11-09", "2026-11-15").map((o) => o.date)).toEqual([
      "2026-11-10", "2026-11-11", "2026-11-12",
    ]);
  });

  it("выполненная задача не размножается", () => {
    const done = task({ dueDate: "2026-11-10", completedAt: 1, recurrence: { freq: "day", interval: 1, end: { type: "never" } } });
    expect(occurrencesInRange(done, "2026-11-09", "2026-11-15")).toEqual([{ date: "2026-11-10", projected: false }]);
  });
});

describe("раскладка по сетке", () => {
  it("непересекающиеся — на всю ширину, пересекающиеся — рядом", () => {
    const layout = layoutTimed([
      { id: "a", start: 600, end: 660 },
      { id: "b", start: 630, end: 720 },
      { id: "c", start: 700, end: 760 },
      { id: "d", start: 900, end: 960 },
    ]);
    const by = Object.fromEntries(layout.map((l) => [l.id, [l.column, l.columns]]));
    expect(by).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2], d: [0, 1] });
  });

  it("buildCalendar: весь день, блоки по времени, длительность по умолчанию — час", () => {
    const days = visibleDays("2026-11-11", "3days");
    const tasks = [
      task({ title: "Без времени", dueDate: "2026-11-11" }),
      task({ title: "Встреча", dueDate: "2026-11-11", dueTime: "09:00" }),
      task({ title: "Длинная", dueDate: "2026-11-12", dueTime: "23:00", durationMinutes: 180 }),
    ];
    const [d1, d2, d3] = buildCalendar(tasks, days);
    expect(d1!.allDay.map((i) => i.task.title)).toEqual(["Без времени"]);
    expect(d1!.timed.map((i) => [i.task.title, i.start, i.end])).toEqual([["Встреча", 540, 600]]);
    expect(d2!.timed[0]).toMatchObject({ start: 1380, end: 1440 }); // обрезано полуночью
    expect(d3!.timed).toEqual([]);
  });
});
