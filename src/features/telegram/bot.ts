import { eq } from "drizzle-orm";
import { Bot, GrammyError, type Api, type Context } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { getInboxListId, getLists } from "@/features/lists/server";
import { getEntries, getGoals } from "@/features/money/server";
import { getSettings, setSetting } from "@/features/settings/server";
import { emptyDraft } from "@/features/tasks/model";
import { completeTask, getOpenTasks, saveTask } from "@/features/tasks/server";
import { getDb, schema } from "@/shared/db/client";
import { shiftDate, todayIn } from "@/shared/lib/dates";
import type { TelegramConfig } from "./config";
import {
  buildEmojiHelp,
  EMOJI_SLOTS,
  emojiRenderer,
  extractCustomEmoji,
  isCustomEmojiError,
  sanitizeEmojiMap,
  slotByName,
  type CustomEmojiMap,
} from "./emoji";
import {
  buildDigest,
  buildMoneyReport,
  buildReminder,
  DIGEST_DONE,
  escapeHtml,
  HELP_TEXT,
  REMINDER_DONE,
  reminderDoneText,
  VARIANT_BY_CODE,
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

const log = (...args: unknown[]) => console.log(new Date().toISOString(), "[bot]", ...args);

function emojiMap(): CustomEmojiMap {
  return sanitizeEmojiMap(getSettings().customEmoji);
}

/**
 * Отправка с премиум-эмодзи пользователя. Если Telegram их отклонил (например, у владельца
 * бота закончился Premium), то же сообщение уходит с обычными эмодзи — уведомление не теряется.
 */
async function withEmoji<T>(send: (emoji: CustomEmojiMap) => Promise<T>): Promise<T> {
  const map = emojiMap();
  try {
    return await send(map);
  } catch (error) {
    if (Object.keys(map).length === 0 || !(error instanceof GrammyError) || !isCustomEmojiError(error.description)) {
      throw error;
    }
    log("премиум-эмодзи отклонены, отправляю с обычными:", error.description);
    return send({});
  }
}

/**
 * @param sentAt когда было отправлено сообщение, которое перерисовываем. Вечерние сводки
 *   показывают только то, что не сделано к моменту отправки, плюс отмеченное после неё.
 */
function digestMessage(
  config: TelegramConfig,
  date: string,
  variant: DigestVariant,
  emoji: CustomEmojiMap,
  sentAt?: Date,
): BotMessage {
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
    emoji,
  });
}

export async function sendDigest(api: Api, config: TelegramConfig, date: string, variant: DigestVariant) {
  await withEmoji((emoji) => {
    const msg = digestMessage(config, date, variant, emoji);
    return api.sendMessage(config.chatId, msg.text, markup(msg));
  });
}

function moneyReport(config: TelegramConfig, today: string, emoji: CustomEmojiMap): BotMessage {
  return buildMoneyReport({
    today,
    entries: getEntries(),
    goals: getGoals(),
    currency: getSettings().currency,
    appUrl: config.appUrl,
    emoji,
  });
}

export async function sendMoneyReport(api: Api, config: TelegramConfig, today: string) {
  await withEmoji((emoji) => {
    const msg = moneyReport(config, today, emoji);
    return api.sendMessage(config.chatId, msg.text, markup(msg));
  });
}

/** Отчёт по запросу из приложения: задачи на сегодня (с кнопками «✓»), затем доходы за месяц. */
export async function sendReport(api: Api, config: TelegramConfig, today: string) {
  await sendDigest(api, config, today, "today");
  await sendMoneyReport(api, config, today);
}

export async function sendReminder(api: Api, config: TelegramConfig, taskId: number) {
  const task = getOpenTasks().find((t) => t.id === taskId);
  if (!task) return;
  await withEmoji((emoji) => {
    const msg = buildReminder(task, emoji);
    return api.sendMessage(config.chatId, msg.text, markup(msg));
  });
}

/** Telegram ругается, если отредактированный текст не изменился, — это не ошибка. */
function isNotModified(error: unknown): boolean {
  return error instanceof GrammyError && error.description.includes("message is not modified");
}

async function ignoreNotModified(edit: Promise<unknown>): Promise<void> {
  try {
    await edit;
  } catch (error) {
    if (!isNotModified(error)) throw error;
  }
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

  bot.command("today", (ctx) =>
    withEmoji((emoji) => {
      const msg = digestMessage(config, todayIn(getSettings().timezone), "today", emoji);
      return ctx.reply(msg.text, markup(msg));
    }),
  );

  bot.command("tomorrow", (ctx) =>
    withEmoji((emoji) => {
      const msg = digestMessage(config, shiftDate(todayIn(getSettings().timezone), 1), "tomorrow", emoji);
      return ctx.reply(msg.text, markup(msg));
    }),
  );

  bot.command("money", (ctx) =>
    withEmoji((emoji) => {
      const msg = moneyReport(config, todayIn(getSettings().timezone), emoji);
      return ctx.reply(msg.text, markup(msg));
    }),
  );

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
    await withEmoji((emoji) =>
      ctx.reply(`${emojiRenderer(emoji)("added")} Добавлено во «Входящие» на сегодня:\n<b>${escapeHtml(title)}</b>`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "✓ Выполнено", callback_data: `rdone:${id}` }]] },
      }),
    );
  });

  // /emoji — показать места для эмодзи; /emoji <место> <премиум-эмодзи> — назначить; «сброс» — вернуть обычные
  bot.command("emoji", async (ctx) => {
    const [name = "", option = ""] = ctx.match.trim().split(/\s+/);
    const current = emojiMap();

    if (!name) {
      await withEmoji((emoji) => ctx.reply(buildEmojiHelp(emoji), { parse_mode: "HTML" }));
      return;
    }
    if (/^(сброс|reset)$/i.test(name)) {
      setSetting("customEmoji", {});
      await ctx.reply("Вернул обычные эмодзи во всех сообщениях.");
      return;
    }

    const slot = slotByName(name);
    if (!slot) {
      await ctx.reply(`Не знаю место «${escapeHtml(name)}». Список мест — /emoji`, { parse_mode: "HTML" });
      return;
    }
    const label = EMOJI_SLOTS[slot].label;
    if (/^(сброс|reset)$/i.test(option)) {
      const { [slot]: _removed, ...rest } = current;
      setSetting("customEmoji", rest);
      await ctx.reply(`Для «${label}» снова обычный ${EMOJI_SLOTS[slot].char}`);
      return;
    }

    const [picked] = extractCustomEmoji(ctx.message?.text ?? "", ctx.message?.entities);
    if (!picked) {
      await ctx.reply(
        `Добавьте после названия премиум-эмодзи из своих наборов, например:\n<code>/emoji ${label}</code> + эмодзи\n\nОбычные эмодзи сюда не подходят — их бот и так использует.`,
        { parse_mode: "HTML" },
      );
      return;
    }

    setSetting("customEmoji", { ...current, [slot]: picked });
    try {
      // Проверочный ответ этим же эмодзи: так сразу видно, принимает ли его Telegram
      await ctx.reply(`${emojiRenderer({ [slot]: picked })(slot)} Теперь это эмодзи для «${label}»`, {
        parse_mode: "HTML",
      });
    } catch (error) {
      if (!(error instanceof GrammyError) || !isCustomEmojiError(error.description)) throw error;
      setSetting("customEmoji", current); // не сработало — не сохраняем
      await ctx.reply(
        "Telegram не разрешил боту этот эмодзи. Премиум-эмодзи работают, если у владельца бота " +
          "(аккаунта, который создал его в @BotFather) есть Telegram Premium.",
      );
    }
  });

  // «✓» под задачей в сводке: отмечаем и перерисовываем сводку за ту же дату тем же вариантом
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
    const message = ctx.callbackQuery.message;
    // Вариант зашит в кнопку; у кнопок из старых сообщений его нет — тогда смотрим на текст
    const variant = (ctx.match[3] && VARIANT_BY_CODE[ctx.match[3]]) || variantOfMessage(message?.text);
    const sentAt = message?.date ? new Date(message.date * 1000) : undefined;
    await ignoreNotModified(
      withEmoji((emoji) => {
        const next = digestMessage(config, date, variant, emoji, sentAt);
        return ctx.editMessageText(next.text, markup(next));
      }),
    );
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
    await ignoreNotModified(
      withEmoji((emoji) =>
        ctx.editMessageText(
          reminderDoneText(title, outcome.type === "rescheduled" ? outcome.nextDue : null, today, emoji),
          { parse_mode: "HTML" },
        ),
      ),
    );
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
  { command: "emoji", description: "Премиум-эмодзи в сообщениях" },
  { command: "help", description: "Помощь" },
];
