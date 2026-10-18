// Отдельный процесс: Telegram-бот (long polling) + планировщик сводки и напоминаний.
// Работает с тем же файлом SQLite, что и веб-приложение (WAL).
import cron from "node-cron";
import { getDb } from "../shared/db/client";
import { BOT_COMMANDS, createBot } from "../features/telegram/bot";
import { getTelegramConfig } from "../features/telegram/config";
import { tick } from "../features/telegram/scheduler";

const log = (...args: unknown[]) => console.log(new Date().toISOString(), "[worker]", ...args);

getDb(); // применит миграции, если worker стартовал раньше веба

const config = getTelegramConfig();
if (!config) {
  log("Telegram не настроен: задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в .env и перезапустите worker.");
  // Не выходим, чтобы менеджер процессов не перезапускал worker по кругу
  setInterval(() => {}, 1 << 30);
} else {
  const bot = createBot(config);

  let running = false;
  const runTick = async () => {
    if (running) return; // предыдущий проход ещё отправляет сообщения
    running = true;
    try {
      await tick(bot.api, config);
    } catch (error) {
      log("ошибка планировщика:", error);
    } finally {
      running = false;
    }
  };

  const task = cron.schedule("* * * * *", runTick);

  const shutdown = async (signal: string) => {
    log(`${signal}: остановка`);
    task.stop();
    await bot.stop();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  await bot.api.setMyCommands(BOT_COMMANDS).catch((error) => log("setMyCommands:", error));
  void runTick(); // догнать сводку/напоминания сразу после старта
  await bot.start({
    allowed_updates: ["message", "callback_query"],
    onStart: (me) => log(`бот @${me.username} запущен, чат ${config.chatId}`),
  });
}
