"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import { spring } from "@/shared/ui/motion";
import { Pressable } from "@/shared/ui/Pressable";

/**
 * Быстрое добавление внизу списка: тап → поле ввода, Enter создаёт задачу
 * и оставляет поле открытым для следующей. Пустое поле при потере фокуса закрывается.
 */
export function QuickAdd({ onCreate }: { onCreate: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const value = title.trim();
    if (value) onCreate(value);
    setTitle("");
    return Boolean(value);
  };

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {editing ? (
        <motion.form
          key="input"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={spring.smooth}
          onSubmit={(e) => {
            e.preventDefault();
            commit();
            inputRef.current?.focus();
          }}
          className="flex items-center gap-3 rounded-[20px] bg-card py-2 pr-4 pl-[18px] shadow-soft"
        >
          <span className="h-6 w-6 shrink-0 rounded-full border-[1.8px] border-muted" />
          <input
            ref={inputRef}
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              commit();
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setTitle("");
                setEditing(false);
              }
            }}
            enterKeyHint="done"
            placeholder="Новая задача"
            aria-label="Название новой задачи"
            className="h-10 min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:text-muted"
          />
        </motion.form>
      ) : (
        <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Pressable
            onClick={() => setEditing(true)}
            className="flex h-14 w-full items-center gap-3 rounded-[20px] pl-[17px] text-[15px] font-semibold text-muted-2"
          >
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-surface-2 text-fg">
              <Plus size={16} strokeWidth={2.4} />
            </span>
            Новая задача
          </Pressable>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
