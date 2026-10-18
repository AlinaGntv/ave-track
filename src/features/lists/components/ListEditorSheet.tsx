"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { BottomSheet, SheetHeader } from "@/shared/ui/BottomSheet";
import { Pressable } from "@/shared/ui/Pressable";
import { LIST_ICON_KEYS, LIST_ICONS, listIcon } from "../icons";

export type ListDraft = { name: string; icon: string };

/** Создание/редактирование списка: название и иконка. Монтируется заново на каждое открытие (key). */
export function ListEditorSheet({
  open,
  initial,
  openCount = 0,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  initial?: ListDraft;
  openCount?: number;
  onClose: () => void;
  onSave: (draft: ListDraft) => void;
  /** Нет для «Входящих» */
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<ListDraft>(initial ?? { name: "", icon: "list" });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const valid = draft.name.trim().length > 0;
  const Icon = listIcon(draft.icon);

  const submit = () => {
    if (!valid) return;
    onSave({ name: draft.name.trim(), icon: draft.icon });
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label={initial ? "Изменить список" : "Новый список"}
      header={
        <SheetHeader
          title={initial ? "Список" : "Новый список"}
          onCancel={onClose}
          onDone={submit}
          doneDisabled={!valid}
        />
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col items-center rounded-[24px] bg-surface px-4 pt-6 pb-4"
      >
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-ink text-on-ink shadow-soft">
          <Icon size={36} strokeWidth={1.9} />
        </span>
        <input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          autoFocus={!initial}
          placeholder="Название списка"
          aria-label="Название списка"
          enterKeyHint="done"
          maxLength={100}
          className="mt-5 h-[52px] w-full rounded-[16px] bg-bg px-4 text-center text-[18px] font-bold outline-none placeholder:text-muted"
        />
      </form>

      <div className="mt-3 grid grid-cols-6 gap-2 rounded-[24px] bg-surface p-3">
        {LIST_ICON_KEYS.map((key) => {
          const ItemIcon = LIST_ICONS[key];
          const active = draft.icon === key;
          return (
            <Pressable
              key={key}
              aria-label={key}
              aria-pressed={active}
              onClick={() => setDraft((d) => ({ ...d, icon: key }))}
              className={cn(
                "flex aspect-square min-h-11 items-center justify-center rounded-full transition-colors",
                active ? "bg-ink text-on-ink" : "bg-bg text-fg",
              )}
            >
              <ItemIcon size={19} />
            </Pressable>
          );
        })}
      </div>

      {onDelete && (
        <Pressable
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true);
            onDelete();
            onClose();
          }}
          className={cn(
            "mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-[20px] px-4 font-semibold transition-colors",
            confirmDelete ? "bg-ink text-on-ink" : "bg-surface text-fg",
          )}
        >
          <Trash2 size={18} className="shrink-0" />
          {confirmDelete
            ? openCount > 0
              ? `Удалить вместе с задачами (${openCount})?`
              : "Точно удалить?"
            : "Удалить список"}
        </Pressable>
      )}
    </BottomSheet>
  );
}
