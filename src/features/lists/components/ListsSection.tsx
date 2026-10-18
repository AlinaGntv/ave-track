"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Trash2 } from "lucide-react";
import { startTransition, useOptimistic, useState } from "react";
import { plural } from "@/features/recurrence/describe";
import { spring } from "@/shared/ui/motion";
import { Pressable, PressableLink } from "@/shared/ui/Pressable";
import { SectionTitle } from "@/shared/ui/ScreenHeader";
import { SwipeRow } from "@/shared/ui/SwipeRow";
import { useToast } from "@/shared/ui/Toast";
import { removeListAction, saveListAction } from "../actions";
import { listIcon } from "../icons";
import type { ListItem } from "../server";
import { ListEditorSheet } from "./ListEditorSheet";

export function ListsSection({ lists: serverLists, inboxId }: { lists: ListItem[]; inboxId: number }) {
  const [lists, addOptimistic] = useOptimistic(serverLists, (state, list: ListItem) => [...state, list]);
  const [editor, setEditor] = useState<{ key: number; open: boolean } | null>(null);
  /** Удалённые свайпом, но ещё не подтверждённые (можно отменить) */
  const [hidden, setHidden] = useState<ReadonlySet<number>>(new Set());
  const toast = useToast();

  const setHiddenFor = (id: number, on: boolean) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  /** Свайп влево: список сразу исчезает, удаление (вместе с задачами) — когда тост закроется без «Отменить». */
  const removeWithUndo = (list: ListItem) => {
    setHiddenFor(list.id, true);
    const tasks = list.openCount ? ` и ${list.openCount} ${plural(list.openCount, ["задача", "задачи", "задач"])}` : "";
    toast.show({
      message: `Удалён «${list.name}»${tasks}`,
      action: { label: "Отменить", onClick: () => setHiddenFor(list.id, false) },
      durationMs: 5000,
      onDismiss: () =>
        startTransition(async () => {
          try {
            await removeListAction(list.id);
          } catch {
            setHiddenFor(list.id, false);
            toast.show({ message: "Не удалось удалить список" });
          }
        }),
    });
  };

  return (
    <>
      <SectionTitle
        title="Мои списки"
        right={
          <Pressable
            onClick={() => setEditor((e) => ({ key: (e?.key ?? 0) + 1, open: true }))}
            className="-mr-3 h-11 px-3 text-[13px] font-semibold text-muted-2"
          >
            Добавить
          </Pressable>
        }
      />
      <ul className="relative mx-4 flex flex-col gap-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {lists
            .filter((list) => !hidden.has(list.id))
            .map((list) => {
              const Icon = listIcon(list.icon);
              const row = (
                <PressableLink
                  href={list.id > 0 ? `/lists/${list.id}` : "#"}
                  className="flex h-16 items-center gap-3 rounded-[20px] bg-card px-4"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-on-ink">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{list.name}</span>
                  <span className="text-[15px] font-semibold text-muted-2 tabular-nums">{list.openCount}</span>
                  <ChevronRight size={18} className="text-muted" />
                </PressableLink>
              );
              return (
                <motion.li
                  key={list.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -40, transition: { duration: 0.2 } }}
                  transition={spring.smooth}
                >
                  {list.id === inboxId || list.id < 0 ? (
                    // «Входящие» удалить нельзя — без свайпа
                    <div className="rounded-[20px] shadow-soft">{row}</div>
                  ) : (
                    <SwipeRow
                      className="rounded-[20px] shadow-soft"
                      trail={{ icon: Trash2, label: "Удалить", onTrigger: () => removeWithUndo(list) }}
                    >
                      {row}
                    </SwipeRow>
                  )}
                </motion.li>
              );
            })}
        </AnimatePresence>
      </ul>
      {lists.length > 1 && (
        <p className="px-6 pt-2 text-[12px] text-muted">Чтобы удалить список, смахните его влево.</p>
      )}

      {editor && (
        <ListEditorSheet
          key={editor.key}
          open={editor.open}
          onClose={() => setEditor((e) => (e ? { ...e, open: false } : e))}
          onSave={(draft) =>
            startTransition(async () => {
              addOptimistic({ id: -Date.now(), ...draft, openCount: 0 });
              try {
                await saveListAction(null, draft);
              } catch {
                toast.show({ message: "Не удалось создать список" });
              }
            })
          }
        />
      )}
    </>
  );
}
