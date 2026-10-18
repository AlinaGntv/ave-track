// Положение bottom sheet при открытой экранной клавиатуре (чистая функция, покрыта тестами).
//
// В iOS клавиатура не уменьшает layout viewport (и 100dvh), а при фокусе поля Safari ещё
// и сдвигает страницу: видимая область (visualViewport) смещается на offsetTop. Fixed-элементы
// позиционируются относительно layout viewport, поэтому sheet нужно явно поставить в видимую
// область: от её верха до верха клавиатуры.

/** Клавиатура считается открытой, если видимая область меньше окна хотя бы на столько */
const KEYBOARD_MIN_PX = 120;

export type SheetFrame = { top: number; height: number };

/** null — клавиатура закрыта, sheet стоит у нижнего края как обычно. */
export function keyboardSheetFrame(viewport: {
  innerHeight: number;
  height: number;
  offsetTop: number;
}): SheetFrame | null {
  if (viewport.innerHeight - viewport.height < KEYBOARD_MIN_PX) return null;
  return { top: Math.max(0, Math.round(viewport.offsetTop)), height: Math.round(viewport.height) };
}
