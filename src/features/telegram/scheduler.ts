import type { Api } from "grammy";
import { getSettings } from "@/features/settings/server";
import { nowTimeIn, shiftDate, todayIn } from "@/shared/lib/dates";
import { sendDigest, sendMoneyReport, sendReminder } from "./bot";
import type { TelegramConfig } from "./config";
import { isDigestDue } from "./schedule";
import { claimNotification, cleanupNotifications, getDueReminders, releaseNotification } from "./server";

const log = (...args: unknown[]) => console.log(new Date().toISOString(), "[scheduler]", ...args);

type SendResult = "sent" | "skipped" | "failed";

/** Сначала бронь в БД, потом отправка; при ошибке бронь снимается и попытка повторится. */
async function sendOnce(kind: string, taskId: number, sentFor: string, send: () => Promise<void>): Promise<SendResult> {
  const claim = claimNotification(kind, taskId, sentFor);
  if (claim == null) return "skipped";
  try {
    await send();
    log(`отправлено: ${kind} ${taskId || ""} ${sentFor}`.replace(/\s+/g, " "));
    return "sent";
  } catch (error) {
    releaseNotification(claim);
    log(`ошибка отправки ${kind} ${sentFor}:`, error);
    return "failed";
  }
}

/** Вечерняя сводка догоняет после простоя worker'а в течение 2 часов */
const EVENING_CATCH_UP_MIN = 120;

/**
 * Один проход планировщика (запускается каждую минуту). Настройки читаются из БД на каждом
 * проходе — изменения времени сводки и часового пояса применяются без перезапуска worker'а.
 */
export async function tick(api: Api, config: TelegramConfig, now = new Date()): Promise<void> {
  const settings = getSettings();
  const today = todayIn(settings.timezone, now);
  const time = nowTimeIn(settings.timezone, now);

  if (isDigestDue(time, settings.digestTime, settings.digestEnabled)) {
    await sendOnce("digest", 0, today, () => sendDigest(api, config, today, "morning"));
  }

  for (const task of getDueReminders(today, time)) {
    // Ключ включает дату и время: перенос задачи или новое вхождение повтора — новое напоминание
    await sendOnce("reminder", task.id, `${task.dueDate}T${task.dueTime}`, () =>
      sendReminder(api, config, task.id),
    );
  }

  if (isDigestDue(time, settings.eveningTime, settings.eveningEnabled, EVENING_CATCH_UP_MIN)) {
    // Три сообщения строго по порядку. Каждое бронируется отдельно: уже отправленные
    // не повторяются, а если одно не ушло — цепочка останавливается и продолжится
    // с него на следующей минуте, чтобы порядок не нарушился.
    const evening: Array<[string, () => Promise<void>]> = [
      ["evening-open", () => sendDigest(api, config, today, "evening")],
      ["evening-tomorrow", () => sendDigest(api, config, shiftDate(today, 1), "tomorrow")],
      ["evening-money", () => sendMoneyReport(api, config, today)],
    ];
    for (const [kind, send] of evening) {
      if ((await sendOnce(kind, 0, today, send)) === "failed") break;
    }
  }

  cleanupNotifications();
}
