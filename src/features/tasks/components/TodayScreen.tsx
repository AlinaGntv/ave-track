"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ListChecks, Repeat } from "lucide-react";
import { describeRecurrence } from "@/features/recurrence/describe";
import { useState } from "react";
import { formatDate } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import { spring } from "@/shared/ui/motion";
import { Pressable } from "@/shared/ui/Pressable";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { Waves } from "@/shared/ui/Waves";
import { useOptimisticTasks } from "../hooks";
import { compareByDue, emptyDraft, formatDueLabel, isDone, PRIORITIES, type TaskItem } from "../model";
import { useQuickAddHandler, useTaskEditor } from "./TaskEditorProvider";
import type { ListOption } from "./TaskEditorSheet";
import { WeekStrip } from "./WeekStrip";

/** Задачи выбранного дня; для сегодняшнего — плюс невыполненные просроченные. */
function tasksForDay(tasks: TaskItem[], day: string, today: string): TaskItem[] {
  return tasks
    .filter((t) => {
      if (!t.dueDate) return false;
      if (t.dueDate === day) return true;
      return day === today && t.dueDate < today && !isDone(t);
    })
    .sort(compareByDue);
}

function timeLabel(task: TaskItem, day: string): string {
  if (task.dueDate && task.dueDate < day) return formatDueLabel(task.dueDate, task.dueTime, day) ?? "";
  return task.dueTime ?? "Весь день";
}

export function TodayScreen({
  today,
  tasks: serverTasks,
  lists,
  inboxId,
}: {
  today: string;
  tasks: TaskItem[];
  lists: ListOption[];
  inboxId: number;
}) {
  const [selected, setSelected] = useState(today);
  const { tasks, keyOf, save, remove, complete, uncomplete } = useOptimisticTasks(serverTasks, today);
  const { openEditor } = useTaskEditor();
  const listNames = new Map(lists.map((l) => [l.id, l.name]));

  useQuickAddHandler(() =>
    openEditor({ defaults: { ...emptyDraft(inboxId), dueDate: selected }, onSubmit: (d) => save(d) }),
  );

  const items = tasksForDay(tasks, selected, today);
  const highlightId = items.find((t) => !isDone(t))?.id;

  const open = (task: TaskItem) => {
    if (task.id < 0) return;
    openEditor({ task, onSubmit: (d) => save(d, task), onDelete: () => remove(task) });
  };
  const toggle = (task: TaskItem) => {
    if (task.id < 0) return;
    if (isDone(task)) uncomplete(task);
    else complete(task);
  };

  return (
    <>
      <ScreenHeader
        caption={formatDate(selected, "d MMMM yyyy")}
        title={selected === today ? "Сегодня" : formatDate(selected, "EEEE")}
      />
      <WeekStrip today={today} selected={selected} onSelect={setSelected} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.ol
          key={selected}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.smooth}
          className="px-4 pt-8"
        >
          {items.length === 0 && (
            <li className="py-12 text-center">
              <p className="text-[17px] font-bold">Свободный день</p>
              <p className="mt-1 text-sm text-muted">Нажмите «+», чтобы запланировать задачу</p>
            </li>
          )}
          {items.map((task, index) => {
            const done = isDone(task);
            const highlighted = task.id === highlightId;
            const last = index === items.length - 1;
            const marks = PRIORITIES[task.priority]?.marks;
            return (
              <motion.li key={keyOf(task)} layout transition={spring.smooth} className="flex gap-3">
                {/* Линия таймлайна с узлом — узел работает как кнопка выполнения */}
                <div className="flex w-8 shrink-0 flex-col items-center">
                  <motion.button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    aria-label={`Выполнить «${task.title}»`}
                    onClick={() => toggle(task)}
                    whileTap={{ scale: 0.85 }}
                    className="-my-2.5 flex h-11 w-11 shrink-0 items-center justify-center"
                  >
                    <span
                      className={cn(
                        "flex h-[15px] w-[15px] items-center justify-center rounded-full border-[1.8px] border-fg bg-bg transition-colors",
                        (highlighted || done) && "ring-[3px] ring-bg outline-[1.5px] outline-fg",
                        done && "bg-fg",
                      )}
                    >
                      {highlighted && !done && <span className="h-[7px] w-[7px] rounded-full bg-fg" />}
                    </span>
                  </motion.button>
                  {!last && <span className="mt-2.5 w-[1.5px] flex-1 bg-fg/80" />}
                </div>

                <div className={cn("min-w-0 flex-1", last ? "pb-4" : "pb-7")}>
                  {highlighted ? (
                    <motion.div
                      whileTap={{ scale: 0.98 }}
                      transition={spring.snappy}
                      onClick={() => open(task)}
                      className="relative -mt-3 cursor-pointer overflow-hidden rounded-[28px] bg-ink p-5 text-on-ink shadow-soft"
                    >
                      <Waves className="text-on-ink opacity-20" />
                      <div className="relative flex items-start justify-between gap-3">
                        <p className="min-w-0 text-[20px] leading-snug font-bold break-words">
                          {marks && <span className="mr-1">{marks}</span>}
                          {task.title}
                        </p>
                        <span className="shrink-0 pt-1 text-[13px] font-semibold">{timeLabel(task, selected)}</span>
                      </div>
                      {task.notes && (
                        <p className="relative mt-2 line-clamp-2 text-[13px] text-on-ink-muted">{task.notes}</p>
                      )}
                      <div className="relative mt-5 flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-3 text-[12px] font-semibold text-on-ink-muted">
                          <span className="truncate">{listNames.get(task.listId)}</span>
                          {task.recurrence && (
                            <span className="inline-flex shrink-0 items-center gap-1">
                              <Repeat size={13} />
                              {describeRecurrence(task.recurrence).split(",")[0]}
                            </span>
                          )}
                          {task.subtasks.length > 0 && (
                            <span className="inline-flex shrink-0 items-center gap-1">
                              <ListChecks size={13} />
                              {task.subtasks.filter((s) => s.completedAt).length}/{task.subtasks.length}
                            </span>
                          )}
                        </span>
                        <Pressable
                          aria-label="Отметить выполненной"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(task);
                          }}
                          className="-m-1.5 flex h-11 w-11 shrink-0 items-center justify-center"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-on-ink text-ink">
                            <Check size={16} strokeWidth={2.6} />
                          </span>
                        </Pressable>
                      </div>
                    </motion.div>
                  ) : (
                    <button type="button" onClick={() => open(task)} className="-mt-1.5 block w-full text-left">
                      <span className="flex items-start justify-between gap-3">
                        <span
                          className={cn(
                            "min-w-0 text-[18px] leading-snug font-bold break-words transition-colors",
                            done && "text-muted line-through decoration-[1.5px]",
                          )}
                        >
                          {marks && <span className="mr-1">{marks}</span>}
                          {task.title}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 pt-1 text-[13px] font-medium text-muted">
                          {task.recurrence && <Repeat size={12} aria-label="Повторяется" />}
                          {timeLabel(task, selected)}
                        </span>
                      </span>
                      {task.notes && (
                        <span className="mt-1 line-clamp-2 block text-[13px] text-muted">{task.notes}</span>
                      )}
                    </button>
                  )}
                </div>
              </motion.li>
            );
          })}
        </motion.ol>
      </AnimatePresence>
    </>
  );
}
