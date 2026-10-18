"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Lock } from "lucide-react";
import { useActionState } from "react";
import { Pressable } from "@/shared/ui/Pressable";
import { spring } from "@/shared/ui/motion";
import { login, type LoginState } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <motion.label
        key={state.error ?? "ok"}
        animate={state.error ? { x: [0, -8, 8, -5, 5, 0] } : {}}
        transition={{ duration: 0.35 }}
        className="flex h-[60px] items-center gap-3 rounded-[20px] bg-surface px-5 shadow-soft"
      >
        <Lock size={20} className="shrink-0 text-muted" />
        <input
          type="password"
          name="password"
          required
          autoFocus
          autoComplete="current-password"
          placeholder="Пароль"
          className="h-full w-full bg-transparent outline-none placeholder:text-muted"
        />
      </motion.label>

      <AnimatePresence>
        {state.error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={spring.snappy}
            className="px-2 text-sm text-muted-2"
          >
            {state.error}
          </motion.p>
        )}
      </AnimatePresence>

      <Pressable
        type="submit"
        disabled={pending}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-ink font-semibold text-on-ink disabled:opacity-60"
      >
        {pending ? "Входим…" : "Войти"}
        {!pending && <ArrowRight size={18} />}
      </Pressable>
    </form>
  );
}
