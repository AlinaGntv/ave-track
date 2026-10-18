"use client";

import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import { Check, Flag, GripVertical, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { haptic } from "@/shared/lib/haptics";
import { spring } from "@/shared/ui/motion";
import { Pressable } from "@/shared/ui/Pressable";
import { SwipeRow } from "@/shared/ui/SwipeRow";
import { useToast } from "@/shared/ui/Toast";
import { completeTaskAction } from "../actions";
import { useOptimisticTasks } from "../hooks";
import {
  defaultsForView,
  emptyDraft,
  groupForView,
  isDone,
  matchesView,
  sortForView,
  type TaskItem,
  type TaskView,
} from "../model";
import { QuickAdd } from "./QuickAdd";
import { useQuickAddHandler, useTaskEditor } from "./TaskEditorProvider";
import type { ListOption } from "./TaskEditorSheet";
import { TaskRow } from "./TaskRow";

/** Сколько отмеченная задача остаётся на месте, прежде чем уехать из списка */
const COMPLETE_DELAY_MS = 1000;

const itemMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: 40, transition: { duration: 0.25 } },
  transition: spring.smooth,
};

/** Строка с ручкой перетаскивания: drag начинается только с ручки, чтобы не мешать скроллу и свайпам. */
function ReorderableItem({
  id,
  onDragEnd,
  children,
}: {
  id: number;
  onDragEnd: () => void;
  children: (handle: ReactNode) => ReactNode;
}) {
  const controls = useDragControls();
  const handle = (
    <button
      type="button"
      aria-label="Перетащить"
      onPointerDown={(e) => {
        e.preventDefault();
        haptic();
        controls.start(e);
      }}
      className="-my-2 flex h-11 w-10 shrink-0 cursor-grab touch-none items-center justify-center text-muted active:cursor-grabbing"
    >
      <GripVertical size={18} />
    </button>
  );
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.03, zIndex: 20 }}
      className="relative"
      {...itemMotion}
    >
      {children(handle)}
    </Reorder.Item>
  );
}

export function TaskListView({
  view,
  tasks: serverTasks,
  today,
  lists,
  inboxId,
  emptyText,
}: {
  view: TaskView;
  tasks: TaskItem[];
  today: string;
  lists: ListOption[];
  inboxId: number;
  emptyText: string;
}) {
  const { tasks, keyOf, save, remove, complete, uncomplete, toggleFlag, reorder } = useOptimisticTasks(
    serverTasks,
    today,
  );
  const { openEditor } = useTaskEditor();
  const toast = useToast();
  const [showCompleted, setShowCompleted] = useState(false);
  const [checking, setChecking] = useState<ReadonlySet<number>>(new Set());
  /** Удалённые свайпом, но ещё не подтверждённые (можно отменить) */
  const [hidden, setHidden] = useState<ReadonlySet<number>>(new Set());
  const [dragOrder, setDragOrder] = useState<number[] | null>(null);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const defaultListId = view.type === "list" ? view.listId : inboxId;
  const newDraft = useCallback(
    () => ({ ...emptyDraft(defaultListId), ...defaultsForView(view, today) }),
    [defaultListId, view, today],
  );

  useQuickAddHandler(() => openEditor({ defaults: newDraft(), onSubmit: (d) => save(d) }));

  // Ушли с экрана во время задержки — всё равно фиксируем выполнение
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const [id, timer] of pending) {
        clearTimeout(timer);
        void completeTaskAction(id);
      }
    };
  }, []);

  const setIn = (setter: typeof setChecking, id: number, on: boolean) =>
    setter((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggle = (task: TaskItem) => {
    if (task.id < 0) return; // ещё не сохранена на сервере
    if (isDone(task)) return uncomplete(task);

    const pending = timers.current.get(task.id);
    if (pending) {
      // Повторный тап в течение задержки — передумали
      clearTimeout(pending);
      timers.current.delete(task.id);
      return setIn(setChecking, task.id, false);
    }

    haptic();
    setIn(setChecking, task.id, true);
    timers.current.set(
      task.id,
      setTimeout(() => {
        timers.current.delete(task.id);
        complete(task);
        setIn(setChecking, task.id, false);
      }, COMPLETE_DELAY_MS),
    );
  };

  /** Свайп влево: строка сразу исчезает, удаление фиксируется, когда тост закроется без «Отменить». */
  const deleteWithUndo = (task: TaskItem) => {
    if (task.id < 0) return;
    setIn(setHidden, task.id, true);
    toast.show({
      message: `Удалено: ${task.title}`,
      action: { label: "Отменить", onClick: () => setIn(setHidden, task.id, false) },
      onDismiss: () => {
        remove(task);
        setIn(setHidden, task.id, false);
      },
    });
  };

  const open = (task: TaskItem) => {
    if (task.id < 0) return;
    openEditor({ task, onSubmit: (d) => save(d, task), onDelete: () => remove(task) });
  };

  const visible = sortForView(
    tasks.filter(
      (t) => !hidden.has(t.id) && (matchesView(t, view, today, showCompleted) || checking.has(t.id)),
    ),
    view,
  );
  const listNames = new Map(lists.map((l) => [l.id, l.name]));
  const showListName = view.type === "smart" && view.kind !== "all";
  const completedCount =
    view.type === "list"
      ? tasks.filter((t) => t.listId === view.listId && isDone(t) && !hidden.has(t.id)).length
      : 0;

  const renderRow = (task: TaskItem, handle?: ReactNode) => {
    const done = isDone(task);
    return (
      <SwipeRow
        className="rounded-[20px] shadow-soft"
        lead={{ icon: Flag, label: task.flagged ? "Снять флажок" : "Флажок", onTrigger: () => toggleFlag(task) }}
        leadFull={
          done
            ? { icon: RotateCcw, label: "Вернуть", onTrigger: () => toggle(task) }
            : { icon: Check, label: "Выполнить", onTrigger: () => toggle(task) }
        }
        trail={{ icon: Trash2, label: "Удалить", onTrigger: () => deleteWithUndo(task) }}
      >
        <TaskRow
          task={task}
          today={today}
          checked={done || checking.has(task.id)}
          listName={showListName ? listNames.get(task.listId) : undefined}
          onToggle={() => toggle(task)}
          onOpen={() => open(task)}
          handle={handle}
        />
      </SwipeRow>
    );
  };

  // Пользовательский список: открытые задачи можно перетаскивать, выполненные — ниже без ручек
  const listView = view.type === "list" ? view : null;
  const openInList = listView ? visible.filter((t) => !isDone(t)) : [];
  const doneInList = listView ? visible.filter((t) => isDone(t)) : [];
  const byId = new Map(openInList.map((t) => [t.id, t]));
  const order = (dragOrder ?? openInList.map((t) => t.id)).filter((id) => byId.has(id));

  const commitOrder = () => {
    if (listView && dragOrder) reorder(listView.listId, dragOrder);
    setDragOrder(null);
  };

  return (
    <div className="px-4">
      {visible.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-10 text-center text-[15px] font-medium text-muted"
        >
          {emptyText}
        </motion.p>
      )}

      {listView ? (
        <>
          <Reorder.Group
            axis="y"
            values={order}
            onReorder={setDragOrder}
            className="relative flex flex-col gap-2.5"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {order.map((id) => {
                const task = byId.get(id)!;
                return (
                  <ReorderableItem key={keyOf(task)} id={id} onDragEnd={commitOrder}>
                    {(handle) => renderRow(task, handle)}
                  </ReorderableItem>
                );
              })}
            </AnimatePresence>
          </Reorder.Group>
          {doneInList.length > 0 && (
            <ul className="relative mt-2.5 flex flex-col gap-2.5">
              <AnimatePresence mode="popLayout" initial={false}>
                {doneInList.map((task) => (
                  <motion.li key={keyOf(task)} layout {...itemMotion}>
                    {renderRow(task)}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
          <div className="mt-2.5" />
        </>
      ) : (
        groupForView(visible, view, today, lists).map((group) => (
          <section key={group.key} className="mb-5">
            {group.title && <h2 className="px-2 pb-2.5 text-[15px] font-bold">{group.title}</h2>}
            <ul className="relative flex flex-col gap-2.5">
              <AnimatePresence mode="popLayout" initial={false}>
                {group.tasks.map((task) => (
                  <motion.li key={keyOf(task)} layout {...itemMotion}>
                    {renderRow(task)}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </section>
        ))
      )}

      {!(view.type === "smart" && view.kind === "completed") && (
        <QuickAdd onCreate={(title) => save({ ...newDraft(), title })} />
      )}

      {completedCount > 0 && (
        <Pressable
          onClick={() => setShowCompleted((v) => !v)}
          className="mx-auto mt-4 flex h-11 items-center px-4 text-[13px] font-semibold text-muted-2"
        >
          {showCompleted ? "Скрыть выполненные" : `Показать выполненные · ${completedCount}`}
        </Pressable>
      )}
    </div>
  );
}
