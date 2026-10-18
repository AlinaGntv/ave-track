"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { QUICK_ADD_EVENT } from "@/shared/navigation/nav";
import { useToast } from "@/shared/ui/Toast";
import { saveTaskAction } from "../actions";
import { cleanDraft, type TaskDraft, type TaskItem } from "../model";
import { TaskEditorSheet, type ListOption } from "./TaskEditorSheet";

export type EditorRequest = {
  /** Существующая задача — режим редактирования, иначе создание */
  task?: TaskItem;
  defaults?: Partial<TaskDraft>;
  onSubmit: (draft: TaskDraft) => void;
  onDelete?: () => void;
};

type EditorApi = {
  openEditor: (request: EditorRequest) => void;
  registerQuickAdd: (handler: (() => void) | null) => void;
};

const EditorContext = createContext<EditorApi | null>(null);

export function useTaskEditor(): EditorApi {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useTaskEditor вне TaskEditorProvider");
  return ctx;
}

/**
 * Экран регистрирует свой обработчик кнопки «+» — например, чтобы новая задача
 * сразу получила дату/список этого экрана и появилась в нём оптимистично.
 */
export function useQuickAddHandler(handler: () => void) {
  const { registerQuickAdd } = useTaskEditor();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    registerQuickAdd(() => ref.current());
    return () => registerQuickAdd(null);
  }, [registerQuickAdd]);
}

export function TaskEditorProvider({
  lists,
  inboxId,
  today,
  children,
}: {
  lists: ListOption[];
  inboxId: number;
  today: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<{ id: number; request: EditorRequest; open: boolean } | null>(null);
  const quickAdd = useRef<(() => void) | null>(null);
  const toast = useToast();

  const openEditor = useCallback((request: EditorRequest) => {
    setState((prev) => ({ id: (prev?.id ?? 0) + 1, request, open: true }));
  }, []);

  const registerQuickAdd = useCallback((handler: (() => void) | null) => {
    quickAdd.current = handler;
  }, []);

  useEffect(() => {
    const onQuickAdd = () => {
      if (quickAdd.current) return quickAdd.current();
      // Экран без своего обработчика (деньги, настройки) — задача уходит во «Входящие»
      openEditor({
        onSubmit: (draft) =>
          startTransition(async () => {
            try {
              await saveTaskAction(null, cleanDraft(draft));
              toast.show({ message: "Задача добавлена" });
            } catch {
              toast.show({ message: "Не удалось сохранить задачу" });
            }
          }),
      });
    };
    window.addEventListener(QUICK_ADD_EVENT, onQuickAdd);
    return () => window.removeEventListener(QUICK_ADD_EVENT, onQuickAdd);
  }, [openEditor, toast]);

  const api = useMemo(() => ({ openEditor, registerQuickAdd }), [openEditor, registerQuickAdd]);
  const close = useCallback(() => setState((prev) => (prev ? { ...prev, open: false } : prev)), []);

  return (
    <EditorContext.Provider value={api}>
      {children}
      {state && (
        <TaskEditorSheet
          // Новый key на каждое открытие — форма инициализируется заново,
          // а при закрытии тот же key сохраняется, чтобы отыграла анимация ухода
          key={state.id}
          open={state.open}
          request={state.request}
          onClose={close}
          lists={lists}
          inboxId={inboxId}
          today={today}
        />
      )}
    </EditorContext.Provider>
  );
}
