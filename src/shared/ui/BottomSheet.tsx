"use client";

import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { spring } from "./motion";
import { lockPageScroll } from "./scroll";

const subscribe = () => () => {};

/**
 * Высота экранной клавиатуры. В iOS Safari клавиатура не уменьшает layout viewport,
 * и fixed-элемент у нижнего края оказывается под ней — поднимаем sheet на эту высоту.
 */
function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setInset(0);
    };
  }, [active]);
  return inset;
}

/**
 * Bottom sheet вместо модального окна. Закрывается свайпом вниз за шапку,
 * тапом по фону или Escape. Анимируются только transform и opacity.
 */
export function BottomSheet({
  open,
  onClose,
  header,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  header?: ReactNode;
  children: ReactNode;
  label: string;
}) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const controls = useDragControls();
  const keyboard = useKeyboardInset(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const unlock = lockPageScroll();
    window.addEventListener("keydown", onKey);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-50 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal
            aria-label={label}
            style={
              keyboard > 0
                ? { bottom: keyboard, maxHeight: `calc(100dvh - ${keyboard}px - 12px)`, paddingBottom: 0 }
                : undefined
            }
            className="pb-safe fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-md flex-col rounded-t-[32px] bg-bg shadow-soft md:bottom-4 md:rounded-[32px]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={spring.sheet}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.9 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
          >
            <div
              className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
              onPointerDown={(e) => controls.start(e)}
            >
              <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-surface-2" />
              {header}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Стандартная шапка sheet: «Отмена» — заголовок — «Готово». */
export function SheetHeader({
  title,
  onCancel,
  onDone,
  doneDisabled,
  doneLabel = "Готово",
}: {
  title: string;
  onCancel: () => void;
  onDone: () => void;
  doneDisabled?: boolean;
  doneLabel?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center px-2 pt-1 pb-2">
      <button
        type="button"
        onClick={onCancel}
        className="h-11 justify-self-start px-3 text-[15px] font-medium text-muted-2"
      >
        Отмена
      </button>
      <h2 className="text-[16px] font-bold">{title}</h2>
      <button
        type="button"
        onClick={onDone}
        disabled={doneDisabled}
        className="h-11 justify-self-end px-3 text-[15px] font-bold text-fg disabled:text-muted"
      >
        {doneLabel}
      </button>
    </div>
  );
}
