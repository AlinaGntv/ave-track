import { describe, expect, it } from "vitest";
import {
  describeEarly,
  dueEarlyReminders,
  earlyHeadline,
  earlyLabel,
  earlyReminderDate,
  normalizeEarly,
  parseEarlyJson,
  serializeEarly,
} from "./early";

describe("ранние напоминания: значения", () => {
  it("нормализация: только корректные, без дублей, от раннего к позднему", () => {
    expect(normalizeEarly(["1w", "1m", "oops", "2w", "1w", "0d", "1000d"])).toEqual(["1m", "2w", "1w"]);
    expect(normalizeEarly(null)).toEqual([]);
  });

  it("хранение в JSON", () => {
    expect(serializeEarly(["1w", "1m"])).toBe('["1m","1w"]');
    expect(serializeEarly([])).toBeNull();
    expect(parseEarlyJson('["2w","bad"]')).toEqual(["2w"]);
    expect(parseEarlyJson("{oops")).toEqual([]);
  });

  it("подписи по-русски", () => {
    expect(earlyLabel("1w")).toBe("за неделю");
    expect(earlyLabel("2w")).toBe("за 2 недели");
    expect(earlyLabel("10d")).toBe("за 10 дней");
    expect(earlyLabel("1m")).toBe("за месяц");
    expect(earlyHeadline("1d")).toBe("Через день");
    expect(earlyHeadline("3d")).toBe("Через 3 дня");
    expect(describeEarly(["1w", "1m", "2w"])).toBe("за месяц, 2 недели, неделю");
    expect(describeEarly([])).toBe("Нет");
  });
});

describe("ранние напоминания: даты", () => {
  it("дата напоминания от срока", () => {
    expect(earlyReminderDate("2026-12-24", "1m")).toBe("2026-11-24");
    expect(earlyReminderDate("2026-12-24", "2w")).toBe("2026-12-10");
    expect(earlyReminderDate("2026-12-24", "1w")).toBe("2026-12-17");
    expect(earlyReminderDate("2026-12-24", "3d")).toBe("2026-12-21");
    // 31 марта «за месяц» — последний день февраля
    expect(earlyReminderDate("2027-03-31", "1m")).toBe("2027-02-28");
  });

  const trip = { id: 1, dueDate: "2026-12-24", earlyReminders: ["1m", "2w", "1w"] };
  const birthday = { id: 2, dueDate: "2026-11-17", earlyReminders: ["1w"] };
  const plain = { id: 3, dueDate: "2026-11-17", earlyReminders: [] };

  it("в день напоминания после времени сводки — отправить", () => {
    const due = dueEarlyReminders([trip, birthday, plain], "2026-11-10", "08:00", "08:00");
    expect(due.map((d) => [d.task.id, d.offset, d.sentFor])).toEqual([[2, "1w", "2026-11-17:1w"]]);
    expect(dueEarlyReminders([trip], "2026-11-24", "21:30", "08:00").map((d) => d.offset)).toEqual(["1m"]);
  });

  it("до времени сводки — ещё рано; в другие дни — ничего", () => {
    expect(dueEarlyReminders([birthday], "2026-11-10", "07:59", "08:00")).toEqual([]);
    expect(dueEarlyReminders([birthday], "2026-11-11", "09:00", "08:00")).toEqual([]);
  });

  it("задачи без даты и с прошедшим сроком пропускаются", () => {
    const noDate = { id: 4, dueDate: null, earlyReminders: ["1d"] };
    const past = { id: 5, dueDate: "2026-11-09", earlyReminders: ["1d"] };
    expect(dueEarlyReminders([noDate, past], "2026-11-12", "09:00", "08:00")).toEqual([]);
    // а за день до срока — как раз пора
    expect(dueEarlyReminders([past], "2026-11-08", "09:00", "08:00")).toHaveLength(1);
  });

  it("у повторяющейся задачи после переноса на следующий год — новый ключ, напоминание придёт снова", () => {
    const nextYear = { ...birthday, dueDate: "2027-11-17" };
    expect(dueEarlyReminders([nextYear], "2027-11-10", "08:00", "08:00")[0]?.sentFor).toBe("2027-11-17:1w");
  });
});
