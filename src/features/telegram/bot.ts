import { Bot, GrammyError, type Api, type Context } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { getInboxListId, getLists } from "@/features/lists/server";
import { getSettings } from "@/features/settings/server";
import { emptyDraft } from "@/features/tasks/model";
import { completeTask, getOpenTasks, saveTask } from "@/features/tasks/server";
import { getDb, schema } from "@/shared/db/client";
import { shiftDate, todayIn } from "@/shared/lib/dates";
import { eq } from "drizzle-orm";
import type { TelegramConfig } from "./config";
import { getEntries, getGoals } from "@/features/money/server";
import {
  buildDigest,
  buildMoneyReport,
  buildReminder,
  DIGEST_DONE,
  escapeHtml,
  HELP_TEXT,
  REMINDER_DONE,
  reminderDoneText,
  variantOfMessage,
  type BotMessage,
  type DigestVariant,
} from "./format";
import { getDigestItems } from "./server";

const markup = (msg: BotMessage) => ({
  parse_mode: "HTML" as const,
  reply_markup: { inline_keyboard: msg.keyboard },
  link_preview_options: { is_disabled: true },
});

/**
 * @param sentAt когда было отправлено сообщение, которое перерисовываем. Вечерние сводки
 *   показывают только то, что не сделано к моменту отправки, плюс отмеченное после неё.
 */
function digestMessage(config: TelegramConfig, date: string, variant: DigestVariant, sentAt?: Date): BotMessage {
  const { timezone } = getSettings();
  const evening = variant === "evening" || variant === "tomorrow";
  return buildDigest({
    date,
    items: getDigestItems(date, timezone, {
      exact: variant === "tomorrow",
      completedSince: evening ? (sentAt ?? new Date()) : undefined,
    }),
    lists: getLists(),
    appUrl: config.appUrl,
    variant,
  });
}

export async function sendDigest(api: Api, config: TelegramConfig, date: string, variant: DigestVariant) {
  const msg = digestMessage(config, date, variant);
  await api.sendMessage(config.chatId, msg.text, markup(msg));
}

function moneyReport(config: TelegramConfig, today: string): BotMessage {
  return buildMoneyReport({
    today,
    entries: getEntries(),
    goals: getGoals(),
    currency: getSettings().currency,
    appUrl: config.appUrl,
  });
}

export async function sendMoneyReport(api: Api, config: TelegramConfig, today: string) {
  const msg = moneyReport(config, today);
  await api.sendMessage(config.chatId, msg.text, markup(msg));
}

export async function sendReminder(api: Api, config: TelegramConfig, taskId: number) {
  const task = getOpenTasks().find((t) => t.id === taskId);
  if (!task) return;
  const msg = buildReminder(task);
  await api.sendMessage(config.chatId, msg.text, markup(msg));
}

/** Telegram ругается, если отредактированный текст не изменился, — это не ошибка. */
function isNotModified(error: unknown): boolean {
  return error instanceof GrammyError && error.description.includes("message is not modified");
}

function taskTitle(id: number): string | null {
  return getDb().select({ title: schema.tasks.title }).from(schema.tasks).where(eq(schema.tasks.id, id)).get()?.title ?? null;
}

export function createBot(config: TelegramConfig, options: { botInfo?: UserFromGetMe } = {}): Bot {
  const bot = new Bot(config.token, options.botInfo ? { botInfo: options.botInfo } : undefined);

  // Бот личный: всё, что пришло не из настроенного чата, молча игнорируется
  bot.use(async (ctx: Context, next) => {
    if (ctx.chat?.id !== config.chatId) return;
    await next();
  });

  bot.command(["start", "help"], (ctx) => ctx.reply(HELP_TEXT, { parse_mode: "HTML" }));

  bot.command("today", async (ctx) => {
    const today = todayIn(getSettings().timezone);
    const msg = digestMessage(config, today, "today");
    await ctx.reply(msg.text, markup(msg));
  });

  bot.command("tomorrow", async (ctx) => {
    const tomorrow = shiftDate(todayIn(getSettings().timezone), 1);
    const msg = digestMessage(config, tomorrow, "tomorrow");
    await ctx.reply(msg.text, markup(msg));
  });

  bot.command("money", async (ctx) => {
    const msg = moneyReport(config, todayIn(getSettings().timezone));
    await ctx.reply(msg.text, markup(msg));
  });

  bot.command("add", async (ctx) => {
    const title = ctx.match.trim();
    if (!title) {
      await ctx.reply("Напишите задачу после команды, например:\n<code>/add Купить хлеб</code>", {
        parse_mode: "HTML",
      });
      return;
    }
    const today = todayIn(getSettings().timezone);
    const id = saveTask(null, { ...emptyDraft(getInboxListId()), title: title.slice(0, 500), dueDate: today });
    await ctx.reply(`➕ Добавлено во «Входящие» на сегодня:\n<b>${escapeHtml(title)}</b>`, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "✓ Выполнено", callback_data: `rdone:${id}` }]] },
    });
  });

  // «✓» под задачей в сводке: отмечаем и перерисовываем сводку за ту же дату
  bot.callbackQuery(DIGEST_DONE, async (ctx) => {
    const id = Number(ctx.match[1]);
    const date = ctx.match[2]!;
    const today = todayIn(getSettings().timezone);
    let answer = "Задача уже удалена";
    if (taskTitle(id) != null) {
      const outcome = completeTask(id, today);
      answer = outcome.type === "rescheduled" ? "Готово ✓ Перенесено на следующий раз" : "Готово ✓";
    }
    await ctx.answerCallbackQuery({ text: answer });
    // Перерисовываем тем же вариантом (утро/вечер/завтра), что и исходное сообщение
    const message = ctx.callbackQuery.message;
    const variant = variantOfMessage(message?.text);
    const sentAt = message?.date ? new Date(message.date * 1000) : undefined;
    const next = digestMessage(config, date, variant, sentAt);
    try {
      await ctx.editMessageText(next.text, markup(next));
    } catch (error) {
      if (!isNotModified(error)) throw error;
    }
  });

  // «✓ Выполнено» под напоминанием или под задачей, добавленной через /add
  bot.callbackQuery(REMINDER_DONE, async (ctx) => {
    const id = Number(ctx.match[1]);
    const title = taskTitle(id);
    if (title == null) {
      await ctx.answerCallbackQuery({ text: "Задача уже удалена" });
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => {});
      return;
    }
    const today = todayIn(getSettings().timezone);
    const outcome = completeTask(id, today);
    await ctx.answerCallbackQuery({ text: "Готово ✓" });
    try {
      await ctx.editMessageText(
        reminderDoneText(title, outcome.type === "rescheduled" ? outcome.nextDue : null, today),
        { parse_mode: "HTML" },
      );
    } catch (error) {
      if (!isNotModified(error)) throw error;
    }
  });

  bot.on("message:text", (ctx) =>
    ctx.reply("Не понял 🙂 Команды: /today, /add <i>текст</i>, /help", { parse_mode: "HTML" }),
  );

  bot.catch(({ error, ctx }) => {
    console.error(`[bot] ошибка при обработке update ${ctx.update.update_id}:`, error);
  });

  return bot;
}

export const BOT_COMMANDS = [
  { command: "today", description: "Задачи на сегодня" },
  { command: "tomorrow", description: "Задачи на завтра" },
  { command: "money", description: "Доходы за месяц" },
  { command: "add", description: "Добавить задачу на сегодня" },
  { command: "help", description: "Помощь" },
];
