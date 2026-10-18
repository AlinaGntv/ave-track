export function formatMoney(cents: number, currency: string, opts?: { compact?: boolean }): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: opts?.compact ? 0 : 2,
    maximumFractionDigits: opts?.compact ? 0 : 2,
  }).format(cents / 100);
}

/** Короткая запись для подписей графика: 1,2 тыс. € */
export function formatMoneyShort(cents: number, currency: string): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

export function currencySymbol(currency: string): string {
  return (
    new Intl.NumberFormat("ru-RU", { style: "currency", currency })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? currency
  );
}

/** Валюты в настройках */
export const CURRENCIES = [
  { code: "EUR", name: "Евро" },
  { code: "USD", name: "Доллар США" },
  { code: "GBP", name: "Фунт стерлингов" },
  { code: "CHF", name: "Швейцарский франк" },
  { code: "PLN", name: "Польский злотый" },
  { code: "CZK", name: "Чешская крона" },
  { code: "RUB", name: "Российский рубль" },
  { code: "UAH", name: "Украинская гривна" },
  { code: "KZT", name: "Казахстанский тенге" },
  { code: "GEL", name: "Грузинский лари" },
  { code: "TRY", name: "Турецкая лира" },
  { code: "AED", name: "Дирхам ОАЭ" },
] as const;
