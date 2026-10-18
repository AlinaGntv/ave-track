"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";
import { useKeyboardScrollFix } from "./scroll";
import { ServiceWorkerRegistration } from "./ServiceWorkerRegistration";
import { ToastProvider } from "./Toast";

export function Providers({ children }: { children: ReactNode }) {
  useKeyboardScrollFix();
  // reducedMotion="user" — уважает prefers-reduced-motion во всех анимациях
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>{children}</ToastProvider>
      <ServiceWorkerRegistration />
    </MotionConfig>
  );
}
