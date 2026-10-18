"use client";

import { startTransition, useCallback, useOptimistic, useRef } from "react";
import { useToast } from "@/shared/ui/Toast";
import {
  completeTaskAction,
  deleteTaskAction,
  reorderTasksAction,
  saveTaskAction,
  uncompleteTaskAction,
} from "./actions";
import {
  applyCompletion,
  cleanDraft,
  completionOutcome,
  draftFromTask,
  formatDueLabel,
  taskFromDraft,
  type TaskDraft,
  type TaskItem,
} from "./model";

type Op =
  | { type: "upsert"; task: TaskItem }
  | { type: "remove"; id: number }
  | { type: "reorder"; ids: number[] };

function reducer(state: TaskItem[], op: Op): TaskItem[] {
  if (op.type === "remove") return state.filter((t) => t.id !== op.id);
  if (op.type === "reorder") {
    const position = new Map(op.ids.map((id, i) => [id, i + 1]));
    return state.map((t) => (position.has(t.id) ? { ...t, sortOrder: position.get(t.id)! } : t));
  }
  const index = state.findIndex((t) => t.id === op.task.id);
  if (index < 0) return [...state, op.task];
  const next = [...state];
  next[index] = op.task;
  return next;
}

/**
 * Оптимистичные мутации: изменение видно сразу, сервер подтверждает в фоне.
 * После ответа server action делает revalidatePath — пропсы приходят свежими,
 * и оптимистичное состояние заменяется настоящим. При ошибке — откат и тост.
 */
export function useOptimisticTasks(tasks: TaskItem[], today: string) {
  const [optimistic, apply] = useOptimistic(tasks, reducer);
  const toast = useToast();

  const run = useCallback(
    (op: Op, action: () => Promise<unknown>) => {
      startTransition(async () => {
        apply(op);
        try {
          await action();
        } catch (error) {
          console.error(error);
          toast.show({ message: "Не удалось сохранить изменения" });
        }
      });
    },
    [apply, toast],
  );

  // Настоящий id → временный id: строка сохраняет React-key после ответа сервера
  // и не «мигает» анимацией ухода/появления при подмене temp → real.
  const tempKeys = useRef(new Map<number, number>());
  const keyOf = useCallback((task: TaskItem) => tempKeys.current.get(task.id) ?? task.id, []);

  const save = useCallback(
    (draft: TaskDraft, existing?: TaskItem) => {
      const clean = cleanDraft(draft);
      const task = taskFromDraft(clean, existing);
      run({ type: "upsert", task }, async () => {
        const id = await saveTaskAction(existing?.id ?? null, clean);
        if (!existing) tempKeys.current.set(id, task.id);
      });
    },
    [run],
  );

  const remove = useCallback(
    (task: TaskItem) => run({ type: "remove", id: task.id }, () => deleteTaskAction(task.id)),
    [run],
  );

  /** Выполнение с тостом «Отменить». Повторяющаяся задача переезжает на следующую дату. */
  const complete = useCallback(
    (task: TaskItem) => {
      const outcome = completionOutcome(task, today);
      run({ type: "upsert", task: applyCompletion(task, outcome) }, () => completeTaskAction(task.id));

      const restoreDue = outcome.type === "rescheduled" ? outcome.prevDue : null;
      toast.show({
        message:
          outcome.type === "rescheduled"
            ? `Следующий раз: ${formatDueLabel(outcome.nextDue, null, today)?.toLowerCase()}`
            : `Выполнено: ${task.title}`,
        action: {
          label: "Отменить",
          onClick: () => run({ type: "upsert", task }, () => uncompleteTaskAction(task.id, restoreDue)),
        },
      });
    },
    [run, toast, today],
  );

  const uncomplete = useCallback(
    (task: TaskItem) =>
      run(
        {
          type: "upsert",
          task: { ...task, completedAt: null, completionCount: Math.max(0, task.completionCount - 1) },
        },
        () => uncompleteTaskAction(task.id, null),
      ),
    [run],
  );

  const toggleFlag = useCallback(
    (task: TaskItem) => save({ ...draftFromTask(task), flagged: !task.flagged }, task),
    [save],
  );

  /** Новый ручной порядок открытых задач списка после перетаскивания. */
  const reorder = useCallback(
    (listId: number, ids: number[]) =>
      run({ type: "reorder", ids }, () => reorderTasksAction(listId, ids.filter((id) => id > 0))),
    [run],
  );

  return { tasks: optimistic, keyOf, save, remove, complete, uncomplete, toggleFlag, reorder };
}
