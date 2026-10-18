"use client";

import { motion } from "framer-motion";
import { Flag, ListChecks, Repeat } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { spring } from "@/shared/ui/motion";
import { formatDueLabel, isOverdue, PRIORITIES, type TaskItem } from "../model";
import { CompleteCircle } from "./CompleteCircle";

export function TaskRow({
  task,
  checked,
  today,
  listName,
  onToggle,
  onOpen,
  handle,
}: {
  task: TaskItem;
  checked: boolean;
  today: string;
  /** Показывается в умных списках, где задачи из разных списков */
  listName?: string;
  onToggle: () => void;
  onOpen: () => void;
  /** Ручка перетаскивания (только в пользовательском списке) */
  handle?: ReactNode;
}) {
  const due = formatDueLabel(task.dueDate, task.dueTime, today);
  const overdue = isOverdue(task, today);
  const marks = PRIORITIES[task.priority]?.marks;
  const subDone = task.subtasks.filter((s) => s.completedAt != null).length;
  const meta = [due, listName].filter(Boolean);

  return (
    <motion.div
      whileTap={{ scale: 0.985 }}
      transition={spring.snappy}
      className={cn(
        "flex items-start gap-3 rounded-[20px] bg-card py-3.5 pl-[18px]",
        handle ? "pr-1" : "pr-4",
      )}
    >
      <div className="pt-px">
        <CompleteCircle checked={checked} onToggle={onToggle} label={`Выполнить «${task.title}»`} />
      </div>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p
          className={cn(
            "text-[15px] leading-snug font-medium break-words transition-colors duration-300",
            checked && "text-muted",
          )}
        >
          {marks && <span className="mr-1 font-bold">{marks}</span>}
          {task.title}
        </p>
        {task.notes && <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-2">{task.notes}</p>}
        {(meta.length > 0 || task.subtasks.length > 0) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-muted-2">
            {due && (
              <span className={cn("inline-flex items-center gap-1", overdue && "font-bold text-fg")}>
                {due}
                {task.recurrence && <Repeat size={12} aria-label="Повторяется" />}
              </span>
            )}
            {listName && <span>{listName}</span>}
            {task.subtasks.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <ListChecks size={13} />
                {subDone}/{task.subtasks.length}
              </span>
            )}
          </p>
        )}
      </button>
      {task.flagged && <Flag size={16} className="mt-1 shrink-0 fill-current text-fg" aria-label="С флажком" />}
      {handle}
    </motion.div>
  );
}
