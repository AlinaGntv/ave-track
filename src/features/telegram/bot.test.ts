// Интеграционный тест бота и планировщика без сети: вызовы Telegram API перехватываются
// трансформером grammY, апдейты подаются через bot.handleUpdate, БД — временный файл SQLite.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fromZonedTime } from "date-fns-tz";
import type { Bot } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const CHAT = 4242;
const TZ = "Europe/Amsterdam";

type Call = { method: string; payload: Record<string, unknown> };
let calls: Call[] = [];
let failNextSend = false;
/** Уронить первую отправку, текст которой подходит под условие */
let failWhen: ((text: string) => boolean) | null = null;
let bot: Bot;
let today: string;
let m: {
  bot: typeof import("./bot");
  scheduler: typeof import("./scheduler");
  tasks: typeof import("@/features/tasks/server");
  lists: typeof import("@/features/lists/server");
  settings: typeof import("@/features/settings/server");
  model: typeof import("@/features/tasks/model");
  dates: typeof import("@/shared/lib/dates");
};

const config = { token: "123:TEST", chatId: CHAT, appUrl: null };
const botInfo = {
  id: 1,
  is_bot: true,
  first_name: "AveTrack",
  username: "avetrack_test_bot",
  can_join_groups: false,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
} as UserFromGetMe;

let updateId = 0;
const chat = (id: number) => ({ id, type: "private" as const, first_name: "Я" });
const user = (id: number) => ({ id, is_bot: false, first_name: "Я" });

function message(text: string, chatId = CHAT): Update {
  updateId++;
  const command = text.startsWith("/") ? text.split(" ")[0]! : null;
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: chat(chatId),
      from: user(chatId),
      text,
      ...(command ? { entities: [{ type: "bot_command", offset: 0, length: command.length }] } : {}),
    },
  } as Update;
}

function press(data: string, text = "", sentAtSec = 0): Update {
  updateId++;
  return {
    update_id: updateId,
    callback_query: {
      id: `cb${updateId}`,
      chat_instance: "x",
      from: user(CHAT),
      data,
      message: { message_id: 99, date: sentAtSec, chat: chat(CHAT), text },
    },
  } as Update;
}

const sent = (method: string) => calls.filter((c) => c.method === method);
const textOf = (call: Call | undefined) => String(call?.payload.text ?? "");
const buttons = (call: Call | undefined) =>
  ((call?.payload.reply_markup as { inline_keyboard?: Array<Array<{ callback_data?: string }>> })?.inline_keyboard ?? [])
    .flat()
    .map((b) => b.callback_data);

beforeAll(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "avetrack-bot-"));
  process.env.DATABASE_PATH = path.join(dir, "test.db");
  m = {
    bot: await import("./bot"),
    scheduler: await import("./scheduler"),
    tasks: await import("@/features/tasks/server"),
    lists: await import("@/features/lists/server"),
    settings: await import("@/features/settings/server"),
    model: await import("@/features/tasks/model"),
    dates: await import("@/shared/lib/dates"),
  };
  m.settings.setSetting("timezone", TZ);
  today = m.dates.todayIn(TZ);

  bot = m.bot.createBot(config, { botInfo });
  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    if (method === "sendMessage" && failNextSend) {
      failNextSend = false;
      throw new Error("сеть недоступна");
    }
    if (method === "sendMessage" && failWhen?.(String((payload as { text?: unknown }).text))) {
      failWhen = null;
      throw new Error("сеть недоступна");
    }
    const result = method === "sendMessage" ? { message_id: calls.length, date: 0, chat: chat(CHAT), text: "" } : true;
    return { ok: true, result } as never;
  });
  // Импорт grammY и миграции временной БД под нагрузкой могут занять дольше 10 с по умолчанию
}, 60_000);

beforeEach(() => {
  calls = [];
});

const newTask = (patch: Partial<import("@/features/tasks/model").TaskDraft>) =>
  m.tasks.saveTask(null, { ...m.model.emptyDraft(m.lists.getInboxListId()), title: "Задача", ...patch });
const taskById = (id: number) =>
  [...m.tasks.getOpenTasks(), ...m.tasks.getCompletedTasks()].find((t) => t.id === id);

describe("бот", () => {
  it("игнорирует чужие чаты", async () => {
    await bot.handleUpdate(message("/today", 777));
    await bot.handleUpdate(message("/add Взлом", 777));
    expect(calls).toEqual([]);
  });

  it("/add добавляет задачу во «Входящие» на сегодня", async () => {
    await bot.handleUpdate(message("/add Купить хлеб"));
    const task = m.tasks.getOpenTasks().find((t) => t.title === "Купить хлеб");
    expect(task).toMatchObject({ listId: m.lists.getInboxListId(), dueDate: today });
    expect(textOf(sent("sendMessage")[0])).toContain("Купить хлеб");
    expect(buttons(sent("sendMessage")[0])).toEqual([`rdone:${task!.id}`]);
  });

  it("/add без текста — подсказка", async () => {
    await bot.handleUpdate(message("/add"));
    expect(textOf(sent("sendMessage")[0])).toContain("Напишите задачу");
  });

  it("/today и «✓» в сводке: задача выполняется, сообщение перерисовывается", async () => {
    const id = newTask({ title: "Позвонить маме", dueDate: today, priority: 3 });
    await bot.handleUpdate(message("/today"));
    const digest = sent("sendMessage")[0];
    expect(textOf(digest)).toContain("<b>!!!</b> Позвонить маме");
    expect(buttons(digest)).toContain(`done:${id}:${today}`);

    calls = [];
    await bot.handleUpdate(press(`done:${id}:${today}`, "📋 ..."));
    expect(taskById(id)?.completedAt).not.toBeNull();
    expect(sent("answerCallbackQuery")[0]?.payload.text).toBe("Готово ✓");
    const edited = sent("editMessageText")[0];
    expect(textOf(edited)).toContain("<s>Позвонить маме</s>");
    expect(buttons(edited)).not.toContain(`done:${id}:${today}`);
  });

  it("повторяющаяся задача из сводки переносится на следующий раз", async () => {
    const id = newTask({
      title: "Зарядка",
      dueDate: today,
      recurrence: { freq: "day", interval: 1, end: { type: "never" } },
    });
    await bot.handleUpdate(press(`done:${id}:${today}`, "☀️ Доброе утро"));
    const task = taskById(id)!;
    expect(task.completedAt).toBeNull();
    expect(task.dueDate).toBe(m.dates.shiftDate(today, 1));
    const edited = textOf(sent("editMessageText")[0]);
    expect(edited).toContain("Доброе утро"); // приветствие сохраняется
    expect(edited).toContain("<s>Зарядка</s> · 🔁 завтра");
  });

  it("«✓ Выполнено» под напоминанием", async () => {
    const id = newTask({ title: "Таблетки", dueDate: today, dueTime: "09:00" });
    await bot.handleUpdate(press(`rdone:${id}`));
    expect(taskById(id)?.completedAt).not.toBeNull();
    expect(textOf(sent("editMessageText")[0])).toBe("✅ <s>Таблетки</s>");
  });

  it("нажатие на удалённую задачу не роняет бота", async () => {
    await bot.handleUpdate(press("rdone:999999"));
    expect(sent("answerCallbackQuery")[0]?.payload.text).toBe("Задача уже удалена");
  });
});

describe("планировщик", () => {
  const at = (time: string) => fromZonedTime(`${today}T${time}:00`, TZ);

  it("утренняя сводка приходит один раз, даже при повторных проходах и перезапуске", async () => {
    m.settings.setSetting("digestTime", "08:00");
    m.settings.setSetting("digestEnabled", true);
    await m.scheduler.tick(bot.api, config, at("07:59"));
    expect(sent("sendMessage")).toHaveLength(0);

    await m.scheduler.tick(bot.api, config, at("08:00"));
    await m.scheduler.tick(bot.api, config, at("08:01"));
    await m.scheduler.tick(bot.api, config, at("08:30"));
    const digests = sent("sendMessage").filter((c) => textOf(c).includes("Доброе утро"));
    expect(digests).toHaveLength(1);
  });

  it("напоминание о задаче со временем — ровно одно; ошибка сети — повтор на следующей минуте", async () => {
    const id = newTask({ title: "Созвон", dueDate: today, dueTime: "10:00" });
    await m.scheduler.tick(bot.api, config, at("09:59"));
    expect(sent("sendMessage").filter((c) => textOf(c).includes("Созвон"))).toHaveLength(0);

    failNextSend = true;
    await m.scheduler.tick(bot.api, config, at("10:00")); // упало — бронь снята
    await m.scheduler.tick(bot.api, config, at("10:01")); // повтор успешен
    await m.scheduler.tick(bot.api, config, at("10:02")); // дубля нет
    const reminders = sent("sendMessage").filter((c) => textOf(c).includes("⏰"));
    expect(reminders).toHaveLength(2); // одна неудачная попытка + одна успешная
    expect(buttons(reminders.at(-1))).toEqual([`rdone:${id}`]);
  });

  it("перенос времени задачи — новое напоминание", async () => {
    const id = newTask({ title: "Встреча", dueDate: today, dueTime: "11:00" });
    await m.scheduler.tick(bot.api, config, at("11:00"));
    const task = taskById(id)!;
    m.tasks.saveTask(id, { ...m.model.draftFromTask(task), dueTime: "11:30" });
    await m.scheduler.tick(bot.api, config, at("11:30"));
    expect(sent("sendMessage").filter((c) => textOf(c).includes("Встреча"))).toHaveLength(2);
  });

  it("выключенная сводка не отправляется", async () => {
    m.settings.setSetting("digestEnabled", false);
    const tomorrowMorning = fromZonedTime(`${m.dates.shiftDate(today, 1)}T08:00:00`, TZ);
    await m.scheduler.tick(bot.api, config, tomorrowMorning);
    expect(sent("sendMessage").filter((c) => textOf(c).includes("Доброе утро"))).toHaveLength(0);
  });
});

describe("вечерняя сводка", () => {
  const atDay = (date: string, time: string) => fromZonedTime(`${date}T${time}:00`, TZ);
  const evening = () =>
    sent("sendMessage")
      .map(textOf)
      .filter((t) => /^(🌙|📅|💰)/.test(t));

  beforeAll(async () => {
    const money = await import("@/features/money/server");
    money.saveEntry(null, { amountCents: 150_000, date: today, note: "Фриланс" });
  });

  it("в 18:00 — три сообщения по порядку: не выполнено, завтра, доходы; без дублей", async () => {
    newTask({ title: "Хвост дня", dueDate: today });
    newTask({ title: "Дело на завтра", dueDate: m.dates.shiftDate(today, 1) });
    newTask({ title: "Дело на послезавтра", dueDate: m.dates.shiftDate(today, 2) });

    await m.scheduler.tick(bot.api, config, atDay(today, "17:59"));
    expect(evening()).toEqual([]);

    await m.scheduler.tick(bot.api, config, atDay(today, "18:00"));
    await m.scheduler.tick(bot.api, config, atDay(today, "18:01"));
    await m.scheduler.tick(bot.api, config, atDay(today, "19:30"));

    const [open, tomorrow, money, ...rest] = evening();
    expect(rest).toEqual([]);
    expect(open).toMatch(/^🌙 <b>Не выполнено сегодня<\/b>/);
    expect(open).toContain("Хвост дня");
    expect(open).not.toContain("Позвонить маме"); // выполнена днём — во вечернем списке её нет
    expect(open).not.toContain("Дело на завтра");
    expect(tomorrow).toMatch(/^📅 <b>Задачи на завтра<\/b>/);
    expect(tomorrow).toContain("Дело на завтра");
    expect(tomorrow).not.toContain("Хвост дня");
    expect(tomorrow).not.toContain("послезавтра");
    expect(money).toMatch(/^💰 <b>Доходы за /);
    expect(money).toContain("Фриланс");
  });

  it("сбой посередине: отправленное не повторяется, порядок сохраняется", async () => {
    const next = m.dates.shiftDate(today, 1);
    failWhen = (text) => text.startsWith("📅");
    await m.scheduler.tick(bot.api, config, atDay(next, "18:00")); // 🌙 ушло, 📅 упало, 💰 не отправлялось
    await m.scheduler.tick(bot.api, config, atDay(next, "18:01")); // догоняем 📅 и 💰
    await m.scheduler.tick(bot.api, config, atDay(next, "18:02"));
    const attempts = sent("sendMessage").map(textOf).map((t) => t.slice(0, 2));
    expect(attempts).toEqual(["🌙", "📅", "📅", "💰"]); // вторая попытка 📅 — после неудачной, 🌙 один раз
  });

  it("выключенная вечерняя сводка не отправляется", async () => {
    m.settings.setSetting("eveningEnabled", false);
    await m.scheduler.tick(bot.api, config, atDay(m.dates.shiftDate(today, 2), "18:00"));
    expect(evening()).toEqual([]);
    m.settings.setSetting("eveningEnabled", true);
  });

  it("«✓» в вечернем сообщении: заголовок сохраняется, задача зачёркивается", async () => {
    const { getDb, schema } = await import("@/shared/db/client");
    const { eq } = await import("drizzle-orm");
    // Задача, выполненная за час до вечернего сообщения, — в нём её быть не должно
    const before = newTask({ title: "Сделано днём", dueDate: today });
    m.tasks.completeTask(before, today);
    getDb()
      .update(schema.taskCompletions)
      .set({ completedAt: new Date(Date.now() - 60 * 60 * 1000) })
      .where(eq(schema.taskCompletions.taskId, before))
      .run();

    const id = newTask({ title: "Доделать вечером", dueDate: today });
    const sentAt = Math.floor(Date.now() / 1000) - 10 * 60; // сообщение пришло 10 минут назад
    await bot.handleUpdate(press(`done:${id}:${today}`, "🌙 Не выполнено сегодня", sentAt));
    const edited = textOf(sent("editMessageText")[0]);
    expect(edited).toMatch(/^🌙 <b>Не выполнено сегодня<\/b>/);
    expect(edited).toContain("<s>Доделать вечером</s>");
    expect(edited).not.toContain("Сделано днём");
  });

  it("/tomorrow и /money", async () => {
    await bot.handleUpdate(message("/tomorrow"));
    await bot.handleUpdate(message("/money"));
    const [tomorrow, money] = sent("sendMessage").map(textOf);
    expect(tomorrow).toMatch(/^📅 <b>Задачи на завтра<\/b>/);
    expect(money).toMatch(/^💰 <b>Доходы за /);
  });
});
