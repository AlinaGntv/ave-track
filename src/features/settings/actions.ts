"use server";

import { Api } from "grammy";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTelegramConfig } from "@/features/telegram/config";
import { isValidTimeZone } from "@/shared/lib/dates";
import { CURRENCIES } from "@/shared/lib/money";
import { setSetting } from "./server";

const currencySchema = z.enum(CURRENCIES.map((c) => c.code) as [string, ...string[]]);

export async function setCurrencyAction(currency: string): Promise<void> {
  setSetting("currency", currencySchema.parse(currency));
  revalidatePath("/", "layout");
}

const notificationsSchema = z
  .object({
    timezone: z.string().refine(isValidTimeZone, "Неизвестный часовой пояс"),
    digestTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    digestEnabled: z.boolean(),
    eveningTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    eveningEnabled: z.boolean(),
  })
  .partial();

/** Worker читает настройки из БД каждую минуту — перезапуск не нужен. */
export async function setNotificationSettingsAction(patch: z.input<typeof notificationsSchema>): Promise<void> {
  const parsed = notificationsSchema.parse(patch);
  if (parsed.timezone !== undefined) setSetting("timezone", parsed.timezone);
  if (parsed.digestTime !== undefined) setSetting("digestTime", parsed.digestTime);
  if (parsed.digestEnabled !== undefined) setSetting("digestEnabled", parsed.digestEnabled);
  if (parsed.eveningTime !== undefined) setSetting("eveningTime", parsed.eveningTime);
  if (parsed.eveningEnabled !== undefined) setSetting("eveningEnabled", parsed.eveningEnabled);
  revalidatePath("/", "layout");
}

/** Проверка связи с ботом прямо из настроек (отправляет веб-процесс, worker не нужен). */
export async function sendTestMessageAction(): Promise<{ ok: boolean; error?: string }> {
  const config = getTelegramConfig();
  if (!config) return { ok: false, error: "В .env не заданы TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID" };
  try {
    await new Api(config.token).sendMessage(config.chatId, "✅ AveTrack на связи — уведомления будут приходить сюда.");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
