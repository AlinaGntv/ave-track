"use client";

import { motion } from "framer-motion";
import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { cn } from "@/shared/lib/cn";
import { haptic } from "@/shared/lib/haptics";
import { spring } from "./motion";

/**
 * «Обновить»: заново запрашивает данные экрана с сервера (router.refresh) — без полной
 * перезагрузки страницы. Стрелка крутится, пока данные загружаются.
 */
export function RefreshButton({ size = "md" }: { size?: "sm" | "md" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <motion.button
      type="button"
      aria-label="Обновить"
      title="Обновить"
      disabled={pending}
      whileTap={{ scale: 0.88 }}
      transition={spring.snappy}
      onClick={() => {
        haptic();
        startTransition(() => router.refresh());
      }}
      className="flex h-11 w-11 shrink-0 items-center justify-center"
    >
      {/* Зона касания всегда 44px; видимый круг — 44px в шапках или 36px рядом с «В Telegram» */}
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-surface text-fg",
          size === "md" ? "h-11 w-11" : "h-9 w-9",
        )}
      >
        <motion.span
          animate={pending ? { rotate: 360 } : { rotate: 0 }}
          transition={pending ? { duration: 0.8, repeat: Infinity, ease: "linear" } : { duration: 0 }}
          className="flex"
        >
          <RotateCw size={size === "md" ? 18 : 16} strokeWidth={2.2} />
        </motion.span>
      </span>
    </motion.button>
  );
}

/** Не чаще, чем раз в столько, обновлять данные при возвращении в приложение */
const AUTO_REFRESH_GAP_MS = 15_000;

/**
 * Автообновление: когда приложение снова на экране (вернулись из Telegram, разблокировали
 * телефон) или появилась сеть — подтягиваем свежие данные. Ничего не рисует.
 */
export function AutoRefresh() {
  const router = useRouter();
  const last = useRef(Date.now());

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last.current < AUTO_REFRESH_GAP_MS) return;
      last.current = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [router]);

  return null;
}
