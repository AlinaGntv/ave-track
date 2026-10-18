/** Лёгкий тактильный отклик там, где он поддерживается (Android); на iOS — тихо ничего. */
export function haptic(durationMs = 8): void {
  try {
    navigator.vibrate?.(durationMs);
  } catch {
    // нет поддержки
  }
}
