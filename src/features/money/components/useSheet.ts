"use client";

import { useCallback, useState } from "react";

/**
 * Состояние bottom sheet с данными: новый key на каждое открытие (форма
 * инициализируется заново), а при закрытии key сохраняется — отыгрывает анимация ухода.
 */
export function useSheet<T = undefined>() {
  const [state, setState] = useState<{ key: number; open: boolean; data: T } | null>(null);
  const open = useCallback((data: T) => setState((s) => ({ key: (s?.key ?? 0) + 1, open: true, data })), []);
  const close = useCallback(() => setState((s) => (s ? { ...s, open: false } : s)), []);
  return { state, open, close };
}
