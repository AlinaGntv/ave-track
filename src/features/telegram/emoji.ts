// Премиум (кастомные) эмодзи в сообщениях бота.
// Bot API разрешает их в сообщениях, которые бот шлёт в личку и группы, если у владельца
// бота есть Telegram Premium (или бот купил доп. юзернейм на Fragment).
// Каждому месту в сообщениях («слоту») можно назначить свой эмодзи командой /emoji;
// без настройки используются обычные эмодзи.

export const EMOJI_SLOTS = {
  morning: { char: "☀️", label: "утро", hint: "утренняя сводка" },
  today: { char: "📋", label: "сегодня", hint: "задачи на сегодня (/today)" },
  evening: { char: "🌙", label: "вечер", hint: "вечером: что не сделано" },
  tomorrow: { char: "📅", label: "завтра", hint: "задачи на завтра" },
  money: { char: "💰", label: "деньги", hint: "отчёт по доходам" },
  open: { char: "◻️", label: "задача", hint: "невыполненная задача" },
  done: { char: "✅", label: "готово", hint: "выполненная задача" },
  reminder: { char: "⏰", label: "напоминание", hint: "напоминание по времени" },
  repeat: { char: "🔁", label: "повтор", hint: "повторяющаяся задача" },
  added: { char: "➕", label: "добавлено", hint: "задача добавлена через /add" },
} as const;

export type EmojiSlot = keyof typeof EMOJI_SLOTS;
export type CustomEmoji = { id: string; alt: string };
export type CustomEmojiMap = Partial<Record<EmojiSlot, CustomEmoji>>;

export const EMOJI_SLOT_KEYS = Object.keys(EMOJI_SLOTS) as EmojiSlot[];

/** Слот по названию из команды: «вечер», «evening», «Вечер». */
export function slotByName(name: string): EmojiSlot | null {
  const n = name.trim().toLowerCase();
  return EMOJI_SLOT_KEYS.find((slot) => slot === n || EMOJI_SLOTS[slot].label === n) ?? null;
}

/**
 * Функция, возвращающая HTML для слота: кастомный эмодзи в теге tg-emoji
 * (внутри — запасной обычный эмодзи для клиентов без поддержки) или обычный эмодзи.
 */
export function emojiRenderer(map: CustomEmojiMap = {}): (slot: EmojiSlot) => string {
  return (slot) => {
    const custom = map[slot];
    return custom ? `<tg-emoji emoji-id="${custom.id}">${custom.alt}</tg-emoji>` : EMOJI_SLOTS[slot].char;
  };
}

/** Оставляет только известные слоты с корректными id — защита от мусора в настройках. */
export function sanitizeEmojiMap(value: unknown): CustomEmojiMap {
  if (!value || typeof value !== "object") return {};
  const result: CustomEmojiMap = {};
  for (const slot of EMOJI_SLOT_KEYS) {
    const item = (value as Record<string, unknown>)[slot] as Partial<CustomEmoji> | undefined;
    if (item && typeof item.id === "string" && /^\d{1,30}$/.test(item.id) && typeof item.alt === "string" && item.alt.length > 0 && item.alt.length <= 16) {
      result[slot] = { id: item.id, alt: item.alt };
    }
  }
  return result;
}

type Entity = { type: string; offset: number; length: number; custom_emoji_id?: string };

/**
 * Достаёт кастомные эмодзи из входящего сообщения. Смещения Telegram считает
 * в UTF-16 — как и строки JavaScript, поэтому slice даёт ровно запасной эмодзи.
 */
export function extractCustomEmoji(text: string, entities: Entity[] | undefined): CustomEmoji[] {
  return (entities ?? [])
    .filter((e) => e.type === "custom_emoji" && e.custom_emoji_id)
    .map((e) => ({ id: e.custom_emoji_id!, alt: text.slice(e.offset, e.offset + e.length) }));
}

/** Ошибка Telegram из-за кастомных эмодзи (нет Premium у владельца бота и т. п.). */
export function isCustomEmojiError(description: string): boolean {
  return /custom.?emoji|ENTITY|emoji/i.test(description);
}

/** Ответ на /emoji без аргументов: текущие эмодзи по местам и как их поменять. */
export function buildEmojiHelp(map: CustomEmojiMap): string {
  const e = emojiRenderer(map);
  const rows = EMOJI_SLOT_KEYS.map((slot) => {
    const custom = map[slot] ? "" : " <i>(обычный)</i>";
    return `${e(slot)} <b>${EMOJI_SLOTS[slot].label}</b> — ${EMOJI_SLOTS[slot].hint}${custom}`;
  });
  return [
    "<b>Эмодзи в сообщениях</b>",
    "",
    ...rows,
    "",
    "Чтобы заменить, отправьте команду, название места и премиум-эмодзи из своих наборов:",
    "<code>/emoji вечер</code> + эмодзи",
    "",
    "Вернуть обычный: <code>/emoji вечер сброс</code>",
    "Вернуть все: <code>/emoji сброс</code>",
  ].join("\n");
}
