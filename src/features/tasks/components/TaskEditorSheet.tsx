"use client";

import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Calendar,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Flag,
  History,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { listIcon } from "@/features/lists/icons";
import { RecurrenceSheet } from "@/features/recurrence/components/RecurrenceSheet";
import { describeRecurrence, plural } from "@/features/recurrence/describe";
import { shiftDate } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import { BottomSheet, SheetHeader } from "@/shared/ui/BottomSheet";
import { spring } from "@/shared/ui/motion";
import { Pressable } from "@/shared/ui/Pressable";
import { Segmented } from "@/shared/ui/Segmented";
import { Switch } from "@/shared/ui/Switch";
import {
  cleanDraft,
  draftFromTask,
  emptyDraft,
  nextTempId,
  PRIORITIES,
  type Priority,
  type TaskDraft,
} from "../model";
import { CompleteCircle } from "./CompleteCircle";
import type { EditorRequest } from "./TaskEditorProvider";

export type ListOption = { id: number; name: string; icon: string };

function Group({ children }: { children: ReactNode }) {
  return <div className="mt-3 divide-y divide-line overflow-hidden rounded-[20px] bg-surface">{children}</div>;
}

function Row({ icon: Icon, label, children }: { icon: typeof Calendar; label: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink">
        <Icon size={16} />
      </span>
      <span className="flex-1 text-[15px] font-medium">{label}</span>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Pressable
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors",
        active ? "bg-ink text-on-ink" : "bg-bg text-fg",
      )}
    >
      {children}
    </Pressable>
  );
}

const inputPill =
  "h-9 rounded-full bg-bg px-3 text-base font-semibold text-fg outline-none [color-scheme:inherit]";

export function TaskEditorSheet({
  open,
  request,
  onClose,
  lists,
  inboxId,
  today,
}: {
  open: boolean;
  request: EditorRequest;
  onClose: () => void;
  lists: ListOption[];
  inboxId: number;
  today: string;
}) {
  const initial = useMemo<TaskDraft>(
    () =>
      request.task
        ? draftFromTask(request.task)
        : { ...emptyDraft(inboxId), ...request.defaults },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [draft, setDraft] = useState(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [recurrenceSheet, setRecurrenceSheet] = useState<{ key: number; open: boolean } | null>(null);
  const set = (patch: Partial<TaskDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const valid = draft.title.trim().length > 0;
  const dirty = JSON.stringify(cleanDraft(draft)) !== JSON.stringify(cleanDraft(initial));
  const isNew = !request.task;

  const submit = () => {
    if (valid && (dirty || isNew)) request.onSubmit(draft);
    onClose();
  };
  // Свайп вниз / тап по фону сохраняет изменения, если они валидны; «Отмена» — отбрасывает
  const dismiss = () => {
    if (valid && dirty) request.onSubmit(draft);
    onClose();
  };

  const setSubtask = (index: number, patch: Partial<TaskDraft["subtasks"][number]>) =>
    set({ subtasks: draft.subtasks.map((s, i) => (i === index ? { ...s, ...patch } : s)) });

  const tomorrow = shiftDate(today, 1);
  const currentList = lists.find((l) => l.id === draft.listId);
  const ListIcon = listIcon(currentList?.icon ?? "list");

  return (
    <BottomSheet
      open={open}
      onClose={dismiss}
      label={isNew ? "Новая задача" : "Детали задачи"}
      header={
        <SheetHeader
          title={isNew ? "Новая задача" : "Детали"}
          onCancel={onClose}
          onDone={submit}
          doneDisabled={!valid}
          doneLabel={isNew ? "Добавить" : "Готово"}
        />
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="rounded-[20px] bg-surface px-4 py-2">
          <input
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            autoFocus={isNew}
            placeholder="Название"
            aria-label="Название"
            enterKeyHint="done"
            className="h-12 w-full bg-transparent text-[17px] font-semibold outline-none placeholder:text-muted"
          />
          <textarea
            value={draft.notes}
            onChange={(e) => {
              set({ notes: e.target.value });
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            rows={2}
            placeholder="Заметка"
            aria-label="Заметка"
            className="w-full resize-none border-t border-line bg-transparent py-3 text-base text-muted-2 outline-none placeholder:text-muted"
          />
        </div>

        <Group>
          <Row icon={Calendar} label="Дата">
            <Switch
              label="Дата"
              checked={draft.dueDate != null}
              onChange={(on) =>
                set(on ? { dueDate: today } : { dueDate: null, dueTime: null, recurrence: null })
              }
            />
          </Row>
          <AnimatePresence initial={false}>
            {draft.dueDate != null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3"
              >
                <Chip active={draft.dueDate === today} onClick={() => set({ dueDate: today })}>
                  Сегодня
                </Chip>
                <Chip active={draft.dueDate === tomorrow} onClick={() => set({ dueDate: tomorrow })}>
                  Завтра
                </Chip>
                <input
                  type="date"
                  value={draft.dueDate}
                  onChange={(e) => e.target.value && set({ dueDate: e.target.value })}
                  aria-label="Выбрать дату"
                  className={inputPill}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <Row icon={Clock} label="Время">
            {draft.dueTime != null && (
              <input
                type="time"
                value={draft.dueTime}
                onChange={(e) => e.target.value && set({ dueTime: e.target.value })}
                aria-label="Выбрать время"
                className={cn(inputPill, "mr-1")}
              />
            )}
            <Switch
              label="Время"
              checked={draft.dueTime != null}
              disabled={draft.dueDate == null}
              onChange={(on) => set({ dueTime: on ? "09:00" : null })}
            />
          </Row>
          <button
            type="button"
            onClick={() => setRecurrenceSheet((s) => ({ key: (s?.key ?? 0) + 1, open: true }))}
            className="block w-full text-left"
          >
            <Row icon={Repeat} label="Повтор">
              <span className="flex min-w-0 max-w-[55%] items-center gap-1 text-[14px] font-semibold text-muted-2">
                <span className="truncate">
                  {draft.recurrence ? describeRecurrence(draft.recurrence) : "Никогда"}
                </span>
                <ChevronRight size={16} className="shrink-0" />
              </span>
            </Row>
          </button>
        </Group>

        {request.task && request.task.completionCount > 0 && (
          <p className="px-4 pt-2 text-[12px] font-medium text-muted-2">
            <History size={12} className="mr-1 inline -translate-y-px" />
            Выполнено {request.task.completionCount}{" "}
            {plural(request.task.completionCount, ["раз", "раза", "раз"])}
            {request.task.lastCompletedAt &&
              ` · последний раз ${format(request.task.lastCompletedAt, "d MMM, HH:mm", { locale: ru })}`}
          </p>
        )}

        {recurrenceSheet && (
          <RecurrenceSheet
            key={recurrenceSheet.key}
            open={recurrenceSheet.open}
            value={draft.recurrence}
            dueDate={draft.dueDate ?? today}
            onClose={() => setRecurrenceSheet((s) => (s ? { ...s, open: false } : s))}
            // Повтор отсчитывается от даты — без даты ставим сегодня
            onChange={(recurrence) =>
              set(recurrence && !draft.dueDate ? { recurrence, dueDate: today } : { recurrence })
            }
          />
        )}

        <Group>
          <Row icon={Flag} label="Флажок">
            <Switch label="Флажок" checked={draft.flagged} onChange={(flagged) => set({ flagged })} />
          </Row>
          <div className="px-3 py-3">
            <p className="px-1 pb-2 text-[13px] font-semibold text-muted-2">Приоритет</p>
            <Segmented<Priority>
              label="Приоритет"
              value={draft.priority}
              onChange={(priority) => set({ priority })}
              options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
            />
          </div>
          <label className="relative block">
            <Row icon={ListIcon} label="Список">
              <span className="flex items-center gap-1 text-[15px] font-semibold text-muted-2">
                {currentList?.name}
                <ChevronsUpDown size={15} />
              </span>
            </Row>
            <select
              value={draft.listId}
              onChange={(e) => set({ listId: Number(e.target.value) })}
              aria-label="Список"
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </Group>

        <div className="mt-3 rounded-[20px] bg-surface px-4 pt-3 pb-1">
          <p className="pb-1 text-[13px] font-semibold text-muted-2">Подзадачи</p>
          <AnimatePresence initial={false}>
            {draft.subtasks.map((sub, index) => (
              <motion.div
                key={sub.id ?? sub.key}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring.smooth}
                className="flex items-center gap-3 border-b border-line py-1"
              >
                <CompleteCircle
                  size={20}
                  checked={sub.done}
                  onToggle={() => setSubtask(index, { done: !sub.done })}
                  label="Подзадача выполнена"
                />
                <input
                  value={sub.title}
                  autoFocus={sub.id == null && sub.title === ""}
                  onChange={(e) => setSubtask(index, { title: e.target.value })}
                  placeholder="Подзадача"
                  aria-label="Подзадача"
                  className={cn(
                    "h-11 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted",
                    sub.done && "text-muted",
                  )}
                />
                <button
                  type="button"
                  aria-label="Удалить подзадачу"
                  onClick={() => set({ subtasks: draft.subtasks.filter((_, i) => i !== index) })}
                  className="-mr-2 flex h-11 w-11 items-center justify-center text-muted"
                >
                  <X size={16} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          <button
            type="button"
            onClick={() =>
              set({
                subtasks: [...draft.subtasks, { key: `new-${nextTempId()}`, title: "", done: false }],
              })
            }
            className="flex h-12 w-full items-center gap-3 text-[15px] font-semibold text-muted-2"
          >
            <Plus size={18} />
            Добавить подзадачу
          </button>
        </div>

        {request.onDelete && (
          <Pressable
            onClick={() => {
              if (!confirmDelete) return setConfirmDelete(true);
              request.onDelete!();
              onClose();
            }}
            className={cn(
              "mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-[20px] font-semibold transition-colors",
              confirmDelete ? "bg-ink text-on-ink" : "bg-surface text-fg",
            )}
          >
            <Trash2 size={18} />
            {confirmDelete ? "Точно удалить?" : "Удалить задачу"}
          </Pressable>
        )}
      </form>
    </BottomSheet>
  );
}
