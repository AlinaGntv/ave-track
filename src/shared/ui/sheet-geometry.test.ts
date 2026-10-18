import { describe, expect, it } from "vitest";
import { keyboardSheetFrame } from "./sheet-geometry";

describe("sheet над клавиатурой", () => {
  it("клавиатура закрыта — обычное положение", () => {
    expect(keyboardSheetFrame({ innerHeight: 844, height: 844, offsetTop: 0 })).toBeNull();
    // небольшие колебания (панель браузера) — не клавиатура
    expect(keyboardSheetFrame({ innerHeight: 844, height: 790, offsetTop: 0 })).toBeNull();
  });

  it("клавиатура открыта, страница не сдвинута — от верха экрана до клавиатуры", () => {
    expect(keyboardSheetFrame({ innerHeight: 844, height: 508, offsetTop: 0 })).toEqual({ top: 0, height: 508 });
  });

  it("iOS сдвинул страницу к полю — окно следует за видимой областью, а не уезжает вверх", () => {
    // Случай со скриншота: видимая область сдвинута на 200px. Раньше окно считалось
    // выше реального и его верх (название задачи) оказывался за экраном
    const frame = keyboardSheetFrame({ innerHeight: 844, height: 508, offsetTop: 200 });
    expect(frame).toEqual({ top: 200, height: 508 });
    expect(frame!.top + frame!.height).toBe(708); // низ окна — ровно над клавиатурой
  });
});
