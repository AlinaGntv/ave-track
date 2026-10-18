import type { Transition } from "framer-motion";

/** Общие spring-пресеты — одинаковое «ощущение» по всему приложению */
export const spring = {
  /** нажатия, мелкие элементы */
  snappy: { type: "spring", stiffness: 520, damping: 34, mass: 0.7 },
  /** перемещения, layout-анимации */
  smooth: { type: "spring", stiffness: 380, damping: 36 },
  /** bottom sheet, переходы экранов */
  sheet: { type: "spring", stiffness: 300, damping: 32 },
} satisfies Record<string, Transition>;
