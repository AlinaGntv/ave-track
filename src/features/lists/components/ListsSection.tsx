"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { startTransition, useOptimistic, useState } from "react";
import { spring } from "@/shared/ui/motion";
import { Pressable, PressableLink } from "@/shared/ui/Pressable";
import { SectionTitle } from "@/shared/ui/ScreenHeader";
import { useToast } from "@/shared/ui/Toast";
import { saveListAction } from "../actions";
import { listIcon } from "../icons";
import type { ListItem } from "../server";
import { ListEditorSheet } from "./ListEditorSheet";

export function ListsSection({ lists: serverLists }: { lists: ListItem[] }) {
  const [lists, addOptimistic] = useOptimistic(serverLists, (state, list: ListItem) => [...state, list]);
  const [editor, setEditor] = useState<{ key: number; open: boolean } | null>(null);
  const toast = useToast();

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
        <AnimatePresence initial={false}>
          {lists.map((list) => {
            const Icon = listIcon(list.icon);
            return (
              <motion.li
                key={list.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={spring.smooth}
              >
                <PressableLink
                  href={list.id > 0 ? `/lists/${list.id}` : "#"}
                  className="flex h-16 items-center gap-3 rounded-[20px] bg-card px-4 shadow-soft"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-on-ink">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{list.name}</span>
                  <span className="text-[15px] font-semibold text-muted-2 tabular-nums">{list.openCount}</span>
                  <ChevronRight size={18} className="text-muted" />
                </PressableLink>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

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
