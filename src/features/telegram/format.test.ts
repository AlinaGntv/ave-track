import { describe, expect, it } from "vitest";
import {
  buildDigest,
  buildMoneyReport,
  buildReminder,
  DIGEST_DONE,
  escapeHtml,
  reminderDoneText,
  variantOfMessage,
  type DigestItem,
} from "./format";
import { isDigestDue, isReminderDue } from "./schedule";

const DATE = "2026-10-17";
const lists = [
  { id: 1, name: "Входящие" },
  { id: 2, name: "Работа <dev>" },
];

let seq = 0;
const item = (patch: Partial<DigestItem>): DigestItem => ({
  id: ++seq,
  title: `Задача ${seq}`,
  listId: 1,
  dueDate: DATE,
  dueTime: null,
  priority: 0,
  flagged: false,
  recurring: false,
  status: "open",
  ...patch,
});

describe("утренняя сводка", () => {
  it("пустой день — короткое сообщение без кнопок задач", () => {
    const msg = buildDigest({ date: DATE, items: [], lists, variant: "morning" });
    expect(msg.text).toContain("Доброе утро");
    expect(msg.text).toContain("Суббота, 17 октября");
    expect(msg.text).toContain("задач нет");
    expect(msg.keyboard).toEqual([]);
  });

  it("группирует по спискам, экранирует HTML, отмечает приоритет и просрочку", () => {
    const a = item({ title: "Отчёт & <b>", listId: 2, priority: 3, dueTime: "09:30" });
    const b = item({ title: "Старое", dueDate: "2026-10-15" });
    const msg = buildDigest({ date: DATE, items: [a, b], lists, variant: "today" });
    expect(msg.text).toContain("<b>Работа &lt;dev&gt;</b>");
    expect(msg.text).toContain("<b>!!!</b> Отчёт &amp; &lt;b&gt; · 09:30");
    expect(msg.text).toContain("<i>просрочено, 15 окт.</i>");
    expect(msg.text.indexOf("Входящие")).toBeLessThan(msg.text.indexOf("Работа"));
    expect(msg.text).toContain("Задач: 2");
  });

  it("кнопка под каждой открытой задачей, выполненные — зачёркнуты и без кнопки", () => {
    const open = item({ title: "Открытая" });
    const done = item({ title: "Готовая", status: "done" });
    const moved = item({ title: "Зарядка", status: "rescheduled", nextDue: "2026-10-18", recurring: true });
    const msg = buildDigest({ date: DATE, items: [open, done, moved], lists, variant: "morning" });
    expect(msg.keyboard).toEqual([[{ text: "✓ Открытая", callback_data: `done:${open.id}:${DATE}` }]]);
    expect(msg.text).toContain("<s>Готовая</s>");
    expect(msg.text).toContain("<s>Зарядка</s> · 🔁 завтра");
    expect(msg.text).toContain("выполнено: 2");
    const button = msg.keyboard[0]![0]!;
    expect("callback_data" in button && DIGEST_DONE.exec(button.callback_data)?.slice(1)).toEqual([
      String(open.id),
      DATE,
    ]);
  });

  it("всё выполнено", () => {
    const msg = buildDigest({ date: DATE, items: [item({ status: "done" })], lists, variant: "morning" });
    expect(msg.text).toContain("Всё сделано");
  });

  it("длинные названия в кнопках обрезаются, ссылка на приложение — последней строкой", () => {
    const long = item({ title: "А".repeat(80) });
    const msg = buildDigest({ date: DATE, items: [long], lists, variant: "morning", appUrl: "https://track.example.com" });
    expect(msg.keyboard[0]![0]!.text.length).toBeLessThanOrEqual(34);
    expect(msg.keyboard.at(-1)).toEqual([{ text: "Открыть AveTrack", url: "https://track.example.com" }]);
  });

  it("не превышает лимит Telegram на длину сообщения", () => {
    const many = Array.from({ length: 300 }, (_, i) => item({ title: `Очень длинная задача номер ${i} `.repeat(3) }));
    const msg = buildDigest({ date: DATE, items: many, lists, variant: "morning" });
    expect(msg.text.length).toBeLessThan(4096);
    expect(msg.keyboard.length).toBeLessThanOrEqual(30);
  });
});

describe("напоминания", () => {
  it("текст и кнопка", () => {
    const msg = buildReminder({ id: 7, title: "Созвон", notes: "План <недели>", dueTime: "15:30", priority: 2 });
    expect(msg.text).toBe("⏰ <b>15:30</b> · <b>!!</b> Созвон\n<i>План &lt;недели&gt;</i>");
    expect(msg.keyboard).toEqual([[{ text: "✓ Выполнено", callback_data: "rdone:7" }]]);
  });

  it("после выполнения повторяющейся — следующая дата", () => {
    expect(reminderDoneText("Зарядка", "2026-10-18", DATE)).toBe("✅ <s>Зарядка</s>\n🔁 Следующий раз: завтра");
    expect(reminderDoneText("A&B", null, DATE)).toBe("✅ <s>A&amp;B</s>");
  });

  it("escapeHtml", () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe(`&lt;a href="x"&gt;&amp;&lt;/a&gt;`);
  });
});

describe("расписание", () => {
  it("сводка: в своё время и с догоном после простоя, но не вечером", () => {
    expect(isDigestDue("07:59", "08:00", true)).toBe(false);
    expect(isDigestDue("08:00", "08:00", true)).toBe(true);
    expect(isDigestDue("10:30", "08:00", true)).toBe(true);
    expect(isDigestDue("20:00", "08:00", true)).toBe(false);
    expect(isDigestDue("08:00", "08:00", false)).toBe(false);
  });

  it("напоминание: в течение часа после времени задачи", () => {
    expect(isReminderDue("09:00", "08:59")).toBe(false);
    expect(isReminderDue("09:00", "09:00")).toBe(true);
    expect(isReminderDue("09:00", "09:59")).toBe(true);
    expect(isReminderDue("09:00", "10:00")).toBe(false);
  });
});

describe("вечерние сообщения", () => {
  it("вечер: только заголовок «Не выполнено», счётчик «Осталось»", () => {
    const msg = buildDigest({ date: DATE, items: [item({ title: "Хвост" })], lists, variant: "evening" });
    expect(msg.text.startsWith("🌙 <b>Не выполнено сегодня</b>")).toBe(true);
    expect(msg.text).toContain("Осталось: 1");
    expect(variantOfMessage(msg.text)).toBe("evening");
  });

  it("вечер без хвостов и пустое завтра", () => {
    expect(buildDigest({ date: DATE, items: [], lists, variant: "evening" }).text).toContain("Все задачи на сегодня выполнены");
    const tomorrow = buildDigest({ date: "2026-10-18", items: [], lists, variant: "tomorrow" });
    expect(tomorrow.text).toBe("📅 <b>Задачи на завтра</b>\nВоскресенье, 18 октября\n\nНа завтра задач нет.");
  });

  it("вариант определяется по уже отправленному сообщению", () => {
    expect(variantOfMessage("☀️ Доброе утро")).toBe("morning");
    expect(variantOfMessage("📅 Задачи на завтра")).toBe("tomorrow");
    expect(variantOfMessage("📋 Суббота")).toBe("today");
    expect(variantOfMessage(undefined)).toBe("today");
  });
});

describe("отчёт по доходам", () => {
  // Intl ставит неразрывные пробелы в суммах — сравниваем с обычными
  const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");
  let id = 0;
  const entry = (date: string, amountCents: number, note: string | null = null) => ({ id: ++id, date, amountCents, note });
  const goal = { id: 1, title: "План", targetCents: 300_000, period: "month" as const, startDate: null, endDate: null };

  it("итог, среднее, сравнение с прошлым месяцем к тому же дню, источники и цели", () => {
    const entries = [
      entry("2026-10-17", 125_050, "Фриланс"),
      entry("2026-10-02", 80_000, "Зарплата"),
      entry("2026-10-05", 20_000, "Фриланс"),
      entry("2026-09-10", 50_000),
      entry("2026-09-25", 999_999), // после 17 сентября — в сравнение не входит
    ];
    const text = plain(buildMoneyReport({ today: DATE, entries, goals: [goal], currency: "EUR" }).text);
    expect(text).toContain("💰 <b>Доходы за октябрь</b>");
    expect(text).toContain("<b>2 250,50 €</b> · 3 записи");
    expect(text).toContain("Сегодня: +1 250,50 €");
    expect(text).toContain("В среднем в день: 132,38 €");
    expect(text).toContain("Сентябрь к этому дню: 500,00 € (↑ 350%)");
    expect(text).toContain("• Фриланс — 1 450,50 € (64%)");
    expect(text).toContain("• Зарплата — 800,00 € (36%)");
    expect(text).toContain("• План — 75% · ещё 750 €");
  });

  it("месяц без доходов", () => {
    const text = plain(buildMoneyReport({ today: DATE, entries: [entry("2026-09-01", 1000)], goals: [], currency: "EUR" }).text);
    expect(text).toContain("В этом месяце доходов пока нет.");
    expect(text).toContain("Сентябрь к этому дню: 10,00 €");
  });

  it("ссылка на экран денег, если задан публичный адрес", () => {
    const msg = buildMoneyReport({ today: DATE, entries: [], goals: [], currency: "EUR", appUrl: "https://t.example" });
    expect(msg.keyboard).toEqual([[{ text: "Открыть «Деньги»", url: "https://t.example/money" }]]);
  });
});
