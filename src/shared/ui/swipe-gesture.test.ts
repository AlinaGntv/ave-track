import { describe, expect, it } from "vitest";
import { decideGesture, stageOf } from "./swipe-gesture";

describe("распознавание свайпа", () => {
  it("маленький сдвиг — ещё неизвестно", () => {
    expect(decideGesture(5, 4, true, true)).toBe("pending");
  });

  it("прокрутка с уходом пальца вбок — это прокрутка, а не свайп", () => {
    // Типичная прокрутка большим пальцем: вверх и немного по диагонали
    expect(decideGesture(14, -30, true, true)).toBe("scroll");
    expect(decideGesture(20, -22, true, true)).toBe("scroll");
    expect(decideGesture(-15, 25, true, true)).toBe("scroll");
  });

  it("явно горизонтальное движение — свайп", () => {
    expect(decideGesture(30, 6, true, true)).toBe("swipe");
    expect(decideGesture(-30, -5, true, true)).toBe("swipe");
  });

  it("в сторону без действия свайпа нет — это прокрутка", () => {
    expect(decideGesture(30, 2, false, true)).toBe("scroll");
    expect(decideGesture(-30, 2, true, false)).toBe("scroll");
  });
});

describe("какое действие срабатывает", () => {
  const all = { lead: true, full: true, trail: true };
  it("по реальному сдвигу строки", () => {
    expect(stageOf(0, all)).toBe("none");
    expect(stageOf(79, all)).toBe("none");
    expect(stageOf(80, all)).toBe("lead");
    expect(stageOf(170, all)).toBe("leadFull");
    expect(stageOf(-110, all)).toBe("trail");
    expect(stageOf(-200, { lead: true, full: true, trail: false })).toBe("none");
  });
});
