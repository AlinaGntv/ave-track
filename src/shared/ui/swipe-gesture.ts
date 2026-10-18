// Чистая логика жеста свайпа строки (используется в SwipeRow, покрыта тестами).

/** Пороги в px: короткий свайп вправо, длинный вправо, свайп влево */
export const LEAD = 80;
export const LEAD_FULL = 170;
export const TRAIL = -110;
/** Сколько нужно сдвинуть палец, чтобы жест был распознан */
const DECIDE_PX = 12;
/** Свайп — только если движение явно горизонтальное */
const HORIZONTAL_RATIO = 1.6;

export type GestureMode = "pending" | "swipe" | "scroll";
export type SwipeStage = "none" | "lead" | "leadFull" | "trail";

/**
 * Что пользователь делает пальцем: пока сдвиг мал — неизвестно; явная горизонталь в сторону,
 * где есть действие, — свайп; всё остальное (включая диагональ) — прокрутка страницы.
 */
export function decideGesture(dx: number, dy: number, canRight: boolean, canLeft: boolean): GestureMode {
  if (Math.abs(dx) < DECIDE_PX && Math.abs(dy) < DECIDE_PX) return "pending";
  const horizontal = Math.abs(dx) > Math.abs(dy) * HORIZONTAL_RATIO;
  return horizontal && (dx > 0 ? canRight : canLeft) ? "swipe" : "scroll";
}

/** Какое действие сработает при отпускании строки, сдвинутой на x. */
export function stageOf(x: number, has: { lead: boolean; full: boolean; trail: boolean }): SwipeStage {
  if (has.full && x >= LEAD_FULL) return "leadFull";
  if (has.lead && x >= LEAD) return "lead";
  if (has.trail && x <= TRAIL) return "trail";
  return "none";
}
