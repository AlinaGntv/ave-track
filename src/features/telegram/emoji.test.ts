import { describe, expect, it } from "vitest";
import {
  buildEmojiHelp,
  emojiRenderer,
  extractCustomEmoji,
  isCustomEmojiError,
  sanitizeEmojiMap,
  slotByName,
} from "./emoji";

describe("премиум-эмодзи", () => {
  it("без настройки — обычные эмодзи, с настройкой — tg-emoji с запасным символом", () => {
    expect(emojiRenderer()("evening")).toBe("🌙");
    const e = emojiRenderer({ evening: { id: "5368324170671202286", alt: "🌜" } });
    expect(e("evening")).toBe('<tg-emoji emoji-id="5368324170671202286">🌜</tg-emoji>');
    expect(e("money")).toBe("💰");
  });

  it("место по названию на русском или английском, без учёта регистра", () => {
    expect(slotByName("Вечер")).toBe("evening");
    expect(slotByName("money")).toBe("money");
    expect(slotByName("утро")).toBe("morning");
    expect(slotByName("ерунда")).toBeNull();
  });

  it("достаёт кастомные эмодзи из сообщения по смещениям UTF-16", () => {
    // «🌙» и «✨» занимают по 2 единицы UTF-16 — смещения как у Telegram
    const text = "/emoji вечер 🌙 и ✨";
    const entities = [
      { type: "bot_command", offset: 0, length: 6 },
      { type: "custom_emoji", offset: 13, length: 2, custom_emoji_id: "111" },
      { type: "custom_emoji", offset: 18, length: 1, custom_emoji_id: "222" },
    ];
    expect(extractCustomEmoji(text, entities)).toEqual([
      { id: "111", alt: "🌙" },
      { id: "222", alt: "✨" },
    ]);
    expect(extractCustomEmoji("без эмодзи", undefined)).toEqual([]);
  });

  it("чистит настройки от мусора", () => {
    expect(
      sanitizeEmojiMap({
        evening: { id: "123", alt: "🌙" },
        money: { id: "abc", alt: "💰" }, // id не число
        unknown: { id: "1", alt: "x" }, // неизвестное место
        done: { id: "5", alt: "" }, // пустой запасной символ
      }),
    ).toEqual({ evening: { id: "123", alt: "🌙" } });
    expect(sanitizeEmojiMap(null)).toEqual({});
  });

  it("распознаёт ошибки Telegram про кастомные эмодзи", () => {
    expect(isCustomEmojiError("Bad Request: CUSTOM_EMOJI_NOT_ALLOWED")).toBe(true);
    expect(isCustomEmojiError("Bad Request: chat not found")).toBe(false);
  });

  it("справка показывает все места и отмечает необычные", () => {
    const help = buildEmojiHelp({ money: { id: "9", alt: "💸" } });
    expect(help).toContain('<tg-emoji emoji-id="9">💸</tg-emoji> <b>деньги</b>');
    expect(help).toContain("🌙 <b>вечер</b> — вечером: что не сделано <i>(обычный)</i>");
    expect(help).toContain("/emoji сброс");
  });
});
