import { describe, expect, it } from "vitest";
import {
  addToTotals,
  centsToInput,
  describeGoalPeriod,
  goalProgress,
  groupEntriesByMonth,
  monthlyTotals,
  parseAmount,
  periodLabel,
  periodRange,
  periodTotals,
  type GoalItem,
  type MoneyEntryItem,
} from "./model";

const TODAY = "2026-10-17"; // суббота

let seq = 0;
const entry = (date: string, amountCents: number, note: string | null = null): MoneyEntryItem => ({
  id: ++seq,
  date,
  amountCents,
  note,
});

const entries = [
  entry("2026-10-12", 10_000), // пн этой недели
  entry("2026-10-11", 5_000), // вс прошлой недели
  entry("2026-10-01", 2_000),
  entry("2026-09-30", 7_000),
  entry("2025-12-31", 100_000),
];

describe("периоды", () => {
  it("границы недели (ISO, пн–вс), месяца и года", () => {
    expect(periodRange("week", TODAY)).toEqual({ from: "2026-10-12", to: "2026-10-18" });
    expect(periodRange("month", TODAY)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodRange("year", TODAY)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(periodRange("all", TODAY)).toEqual({ from: null, to: null });
  });

  it("суммы по периодам", () => {
    expect(periodTotals(entries, TODAY)).toEqual({
      week: 10_000,
      month: 17_000,
      year: 24_000,
      all: 124_000,
    });
  });

  it("оптимистичное добавление попадает только в нужные периоды", () => {
    const totals = periodTotals(entries, TODAY);
    expect(addToTotals(totals, { date: "2026-09-15", amountCents: 500 }, TODAY)).toEqual({
      ...totals,
      year: totals.year + 500,
      all: totals.all + 500,
    });
  });

  it("подписи", () => {
    expect(periodLabel("month", TODAY)).toBe("за октябрь");
    expect(periodLabel("year", TODAY)).toBe("за 2026 год");
    expect(periodLabel("all", TODAY)).toBe("за всё время");
  });
});

describe("цели", () => {
  const goal = (patch: Partial<GoalItem>): GoalItem => ({
    id: 1,
    title: "Цель",
    targetCents: 20_000,
    period: null,
    startDate: null,
    endDate: null,
    ...patch,
  });

  it("ежемесячная цель считает только текущий месяц", () => {
    const p = goalProgress(goal({ period: "month" }), entries, TODAY);
    expect(p).toMatchObject({ earnedCents: 17_000, percent: 85, remainingCents: 3_000, achieved: false, daysLeft: 14 });
  });

  it("цель с дедлайном и перевыполнение", () => {
    const p = goalProgress(goal({ startDate: "2026-01-01", endDate: "2026-12-31", targetCents: 12_000 }), entries, TODAY);
    expect(p).toMatchObject({ earnedCents: 24_000, percent: 200, remainingCents: 0, achieved: true, daysLeft: 75 });
  });

  it("просроченная недостигнутая цель", () => {
    const p = goalProgress(goal({ startDate: "2026-09-01", endDate: "2026-09-30" }), entries, TODAY);
    expect(p).toMatchObject({ earnedCents: 7_000, expired: true });
  });

  it("бессрочная цель", () => {
    const p = goalProgress(goal({ targetCents: 1_000_000 }), entries, TODAY);
    expect(p).toMatchObject({ earnedCents: 124_000, percent: 12, daysLeft: null, expired: false });
  });

  it("описание периода", () => {
    expect(describeGoalPeriod(goal({ period: "month" }))).toBe("Каждый месяц");
    expect(describeGoalPeriod(goal({ endDate: "2026-12-31" }))).toBe("До 31 декабря 2026");
  });
});

describe("график и список", () => {
  it("последние 12 месяцев, пустые месяцы — нули", () => {
    const months = monthlyTotals(entries, TODAY);
    expect(months).toHaveLength(12);
    expect(months[0]).toMatchObject({ month: "2025-11", total: 0 });
    expect(months[1]).toMatchObject({ month: "2025-12", total: 100_000 });
    expect(months.at(-2)).toMatchObject({ month: "2026-09", total: 7_000 });
    expect(months.at(-1)).toMatchObject({ month: "2026-10", total: 17_000, label: "окт" });
  });

  it("группировка по месяцам, новые сверху", () => {
    const groups = groupEntriesByMonth(entries);
    expect(groups.map((g) => [g.title, g.total, g.entries.length])).toEqual([
      ["Октябрь 2026", 17_000, 3],
      ["Сентябрь 2026", 7_000, 1],
      ["Декабрь 2025", 100_000, 1],
    ]);
    expect(groups[0]!.entries[0]!.date).toBe("2026-10-12");
  });
});

describe("ввод сумм", () => {
  it("разбирает разные форматы", () => {
    expect(parseAmount("12")).toBe(1200);
    expect(parseAmount("12,5")).toBe(1250);
    expect(parseAmount("1 234,56")).toBe(123_456);
    expect(parseAmount("1234.05")).toBe(123_405);
    expect(parseAmount("0,01")).toBe(1);
  });

  it("отклоняет мусор, ноль и лишние знаки", () => {
    for (const bad of ["", "0", "abc", "-5", "1,234", "12.345", "1e5"]) expect(parseAmount(bad)).toBeNull();
  });

  it("обратное преобразование для редактирования", () => {
    expect(centsToInput(1200)).toBe("12");
    expect(centsToInput(1250)).toBe("12,5");
    expect(centsToInput(123_405)).toBe("1234,05");
    expect(parseAmount(centsToInput(98_765))).toBe(98_765);
  });
});
