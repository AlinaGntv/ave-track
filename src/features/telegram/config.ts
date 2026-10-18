export type TelegramConfig = {
  token: string;
  /** Единственный чат, которому бот отвечает (может быть отрицательным для групп) */
  chatId: number;
  /** Публичный адрес приложения для кнопки «Открыть» — только не localhost (Telegram их отклоняет) */
  appUrl: string | null;
};

export function getTelegramConfig(env: NodeJS.ProcessEnv = process.env): TelegramConfig | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chat = env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chat || !/^-?\d+$/.test(chat)) return null;
  return { token, chatId: Number(chat), appUrl: publicUrl(env.APP_URL) };
}

function publicUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (!/^https?:$/.test(url.protocol)) return null;
    if (["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(url.hostname)) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
