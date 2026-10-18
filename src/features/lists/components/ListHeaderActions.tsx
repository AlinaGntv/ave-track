"use client";

import { Ellipsis } from "lucide-react";
import { startTransition, useState } from "react";
import { Pressable } from "@/shared/ui/Pressable";
import { useToast } from "@/shared/ui/Toast";
import { deleteListAction, saveListAction } from "../actions";
import type { ListItem } from "../server";
import { ListEditorSheet } from "./ListEditorSheet";

/** Кнопка «…» в шапке списка: переименовать, сменить иконку, удалить. */
export function ListHeaderActions({ list, isInbox }: { list: ListItem; isInbox: boolean }) {
  const [editor, setEditor] = useState<{ key: number; open: boolean } | null>(null);
  const toast = useToast();

  return (
    <>
      <Pressable
        aria-label="Настроить список"
        onClick={() => setEditor((e) => ({ key: (e?.key ?? 0) + 1, open: true }))}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface"
      >
        <Ellipsis size={20} />
      </Pressable>
      {editor && (
        <ListEditorSheet
          key={editor.key}
          open={editor.open}
          initial={{ name: list.name, icon: list.icon }}
          openCount={list.openCount}
          onClose={() => setEditor((e) => (e ? { ...e, open: false } : e))}
          onSave={(draft) =>
            startTransition(async () => {
              try {
                await saveListAction(list.id, draft);
              } catch {
                toast.show({ message: "Не удалось сохранить список" });
              }
            })
          }
          onDelete={isInbox ? undefined : () => startTransition(() => deleteListAction(list.id))}
        />
      )}
    </>
  );
}
