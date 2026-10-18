"use client";

import { useEffect } from "react";

/** Регистрирует service worker в production (в dev он мешал бы hot reload кэшем). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => console.error("SW:", error));
  }, []);
  return null;
}
