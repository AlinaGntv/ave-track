import { describe, expect, it } from "vitest";
import { describeRecurrence, plural } from "./describe";
import { nextDueAfterCompletion, nextOccurrence } from "./next";
import { defaultRecurrence, parseRecurrence, serializeRecurrence, type Recurrence } from "./rule";

const never = { type: "never" } as const;
const rule = (r: Omit<Recurrence, "end"> & { end?: Recurrence["end"] }): Recurrence => ({ end: never, ...r });

/** Первые n вхождений после from (from — якорь, сам в результат не входит) */
function series(r: Recurrence, from: string, n: number): string[] {
  const out: string[] = [];
  let cur = from;
  for (let i = 0; i < n; i++) out.push((cur = nextOccurrence(r, cur)));
  return out;
}

describe("nextOccurrence: дни и годы", () => {
  it("каждый день и каждые N дней, через границы месяца и года", () => {
    expect(series(rule({ freq: "day", interval: 1 }), "2026-12-30", 3)).toEqual([
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
    expect(series(rule({ freq: "day", interval: 3 }), "2026-10-17", 2)).toEqual(["2026-10-20", "2026-10-23"]);
  });

  it("переход на зимнее время (25 окт. 2026, Европа) не сдвигает даты", () => {
    expect(series(rule({ freq: "day", interval: 1 }), "2026-10-24", 2)).toEqual(["2026-10-25", "2026-10-26"]);
    expect(series(rule({ freq: "day", interval: 1 }), "2027-03-27", 2)).toEqual(["2027-03-28", "2027-03-29"]);
  });

  it("каждый год; 29 февраля прижимается к 28-му", () => {
    expect(nextOccurrence(rule({ freq: "year", interval: 1 }), "2026-10-17")).toBe("2027-10-17");
    expect(nextOccurrence(rule({ freq: "year", interval: 2 }), "2028-02-29")).toBe("2030-02-28");
  });
});

describe("nextOccurrence: недели", () => {
  it("каждую неделю без выбора дней — +7 дней", () => {
    expect(nextOccurrence(rule({ freq: "week", interval: 1 }), "2026-10-17")).toBe("2026-10-24");
  });

  it("пн, ср, пт каждую неделю", () => {
    const r = rule({ freq: "week", interval: 1, weekdays: [1, 3, 5] });
    // 19.10.2026 — понедельник
    expect(series(r, "2026-10-19", 4)).toEqual(["2026-10-21", "2026-10-23", "2026-10-26", "2026-10-28"]);
  });

  it("раз в 2 недели по пн и ср — после среды прыжок на понедельник через неделю", () => {
    const r = rule({ freq: "week", interval: 2, weekdays: [1, 3] });
    expect(series(r, "2026-10-19", 4)).toEqual(["2026-10-21", "2026-11-02", "2026-11-04", "2026-11-16"]);
  });

  it("стартовая дата не из списка дней — ближайший выбранный день", () => {
    const r = rule({ freq: "week", interval: 1, weekdays: [1, 3] });
    expect(nextOccurrence(r, "2026-10-20")).toBe("2026-10-21"); // вт → ср
    expect(nextOccurrence(r, "2026-10-25")).toBe("2026-10-26"); // вс → пн
  });
});

describe("nextOccurrence: месяцы", () => {
  it("конкретное число", () => {
    const r = rule({ freq: "month", interval: 1, monthly: { type: "day", day: 15 } });
    expect(series(r, "2026-10-15", 3)).toEqual(["2026-11-15", "2026-12-15", "2027-01-15"]);
    // Задача создана до нужного числа — вхождение в этом же месяце
    expect(nextOccurrence(r, "2026-10-05")).toBe("2026-10-15");
  });

  it("31-е число в коротких месяцах — последний день, без дрейфа", () => {
    const r = rule({ freq: "month", interval: 1, monthly: { type: "day", day: 31 } });
    expect(series(r, "2027-01-31", 4)).toEqual(["2027-02-28", "2027-03-31", "2027-04-30", "2027-05-31"]);
    expect(nextOccurrence(r, "2028-01-31")).toBe("2028-02-29");
  });

  it("каждый второй вторник месяца", () => {
    const r = rule({ freq: "month", interval: 1, monthly: { type: "nth", nth: 2, weekday: 2 } });
    expect(series(r, "2026-10-13", 3)).toEqual(["2026-11-10", "2026-12-08", "2027-01-12"]);
  });

  it("последняя пятница; раз в 3 месяца", () => {
    const r = rule({ freq: "month", interval: 3, monthly: { type: "nth", nth: -1, weekday: 5 } });
    expect(series(r, "2026-10-30", 2)).toEqual(["2027-01-29", "2027-04-30"]);
  });

  it("без явного правила — число из текущей даты", () => {
    expect(nextOccurrence(rule({ freq: "month", interval: 2 }), "2026-10-17")).toBe("2026-12-17");
  });
});

describe("nextDueAfterCompletion", () => {
  const TODAY = "2026-10-17";
  const daily = rule({ freq: "day", interval: 1 });

  it("выполнено в срок — следующее вхождение", () => {
    expect(nextDueAfterCompletion(daily, TODAY, TODAY, 1)).toBe("2026-10-18");
  });

  it("просрочено — пропущенные вхождения не копятся, дата позже сегодня", () => {
    expect(nextDueAfterCompletion(daily, "2026-10-10", TODAY, 1)).toBe("2026-10-18");
    const every3 = rule({ freq: "day", interval: 3 });
    // 10 → 13 → 16 → 19: сохраняется шаг серии
    expect(nextDueAfterCompletion(every3, "2026-10-10", TODAY, 1)).toBe("2026-10-19");
  });

  it("выполнено заранее — после исходного срока", () => {
    const weekly = rule({ freq: "week", interval: 1 });
    expect(nextDueAfterCompletion(weekly, "2026-10-20", TODAY, 1)).toBe("2026-10-27");
  });

  it("окончание после N повторений", () => {
    const r = rule({ freq: "day", interval: 1, end: { type: "count", count: 3 } });
    expect(nextDueAfterCompletion(r, TODAY, TODAY, 1)).toBe("2026-10-18");
    expect(nextDueAfterCompletion(r, "2026-10-18", "2026-10-18", 2)).toBe("2026-10-19");
    expect(nextDueAfterCompletion(r, "2026-10-19", "2026-10-19", 3)).toBeNull();
  });

  it("окончание по дате — дата окончания включительно", () => {
    const r = rule({ freq: "day", interval: 1, end: { type: "until", date: "2026-10-18" } });
    expect(nextDueAfterCompletion(r, TODAY, TODAY, 1)).toBe("2026-10-18");
    expect(nextDueAfterCompletion(r, "2026-10-18", "2026-10-18", 2)).toBeNull();
  });
});

describe("хранение правила", () => {
  it("сериализация нормализует лишние поля и порядок дней", () => {
    const json = serializeRecurrence({
      freq: "week",
      interval: 1,
      weekdays: [5, 1, 3, 1],
      monthly: { type: "day", day: 3 },
      end: never,
    });
    expect(parseRecurrence(json)).toEqual({ freq: "week", interval: 1, weekdays: [1, 3, 5], end: never });
  });

  it("битый или невалидный JSON — null", () => {
    expect(parseRecurrence("{oops")).toBeNull();
    expect(parseRecurrence(JSON.stringify({ freq: "hour", interval: 1, end: never }))).toBeNull();
    expect(parseRecurrence(null)).toBeNull();
  });

  it("правило по умолчанию привязано к дате задачи", () => {
    expect(defaultRecurrence("week", "2026-10-17").weekdays).toEqual([6]); // суббота
    expect(defaultRecurrence("month", "2026-10-17").monthly).toEqual({ type: "day", day: 17 });
  });
});

describe("описание", () => {
  it("множественное число", () => {
    expect([1, 2, 5, 11, 21, 22, 112].map((n) => plural(n, ["день", "дня", "дней"]))).toEqual([
      "день",
      "дня",
      "дней",
      "дней",
      "день",
      "дня",
      "дней",
    ]);
  });

  it("человекочитаемые правила", () => {
    expect(describeRecurrence(rule({ freq: "day", interval: 1 }))).toBe("Каждый день");
    expect(describeRecurrence(rule({ freq: "day", interval: 21 }))).toBe("Раз в 21 день");
    expect(describeRecurrence(rule({ freq: "week", interval: 2, weekdays: [1, 3, 5] }))).toBe(
      "Раз в 2 недели: пн, ср, пт",
    );
    expect(describeRecurrence(rule({ freq: "week", interval: 1, weekdays: [1, 2, 3, 4, 5] }))).toBe(
      "Каждую неделю: по будням",
    );
    expect(
      describeRecurrence(rule({ freq: "month", interval: 1, monthly: { type: "nth", nth: 2, weekday: 2 } })),
    ).toBe("Каждый месяц, во второй вторник");
    expect(
      describeRecurrence(rule({ freq: "month", interval: 1, monthly: { type: "nth", nth: -1, weekday: 5 } })),
    ).toBe("Каждый месяц, в последнюю пятницу");
    expect(describeRecurrence(rule({ freq: "month", interval: 1, monthly: { type: "day", day: 15 } }))).toBe(
      "Каждый месяц, 15-го числа",
    );
    expect(describeRecurrence(rule({ freq: "year", interval: 5, end: { type: "count", count: 3 } }))).toBe(
      "Раз в 5 лет, 3 раза",
    );
    expect(describeRecurrence(rule({ freq: "day", interval: 1, end: { type: "until", date: "2027-12-31" } }))).toBe(
      "Каждый день, до 31 дек. 2027",
    );
  });
});
