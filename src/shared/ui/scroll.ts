"use client";

import { useEffect } from "react";

// Блокировка прокрутки страницы под bottom sheet. Счётчик нужен для вложенных sheet
// (редактор задачи → выбор повтора): прокрутка возвращается, только когда закрыты все.
let locks = 0;

export function lockPageScroll(): () => void {
  locks += 1;
  if (locks === 1) document.body.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) document.body.style.removeProperty("overflow");
  };
}

/**
 * iOS после закрытия экранной клавиатуры иногда оставляет страницу сдвинутой: верх
 * становится недостижим прокруткой. Когда клавиатура закрылась, возвращаем прокрутку
 * в допустимые границы — браузер пересчитывает viewport.
 */
export function useKeyboardScrollFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let keyboardOpen = false;
    const onResize = () => {
      const open = window.innerHeight - vv.height > 120;
      if (keyboardOpen && !open) {
        setTimeout(() => {
          const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          window.scrollTo({ top: Math.min(window.scrollY, max), left: 0 });
        }, 50);
      }
      keyboardOpen = open;
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);
}
