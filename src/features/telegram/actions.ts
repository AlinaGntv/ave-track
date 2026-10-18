"use server";

import { Api, GrammyError } from "grammy";
import { getSettings } from "@/features/settings/server";
import { todayIn } from "@/shared/lib/dates";
import { sendReport } from "./bot";
import { getTelegramConfig } from "./config";

export type SendReportResult = { ok: true } | { ok: false; error: string };

/**
 * Кнопка «В Telegram» в приложении: отправляет задачи на сегодня и доходы за месяц.
 * Шлёт сам веб-процесс; чтобы кнопки «✓» под сообщением работали, нужен запущенный worker.
 */
export async function sendReportAction(): Promise<SendReportResult> {
  const config = getTelegramConfig();
  if (!config) return { ok: false, error: "Бот не настроен: нет TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID" };
  try {
    await sendReport(new Api(config.token), config, todayIn(getSettings().timezone));
    return { ok: true };
  } catch (error) {
    console.error("[telegram] отчёт не отправлен:", error);
    const message = error instanceof GrammyError ? error.description : "нет связи с Telegram";
    return { ok: false, error: message };
  }
}
