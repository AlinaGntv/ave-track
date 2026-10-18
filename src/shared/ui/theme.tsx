"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "avetrack-theme";

/** Выполняется до гидрации, чтобы не было вспышки светлой темы. */
export const themeScript = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);if(p){var m=function(){document.querySelectorAll('meta[name="theme-color"]').forEach(function(e){e.setAttribute("content",d?"#0c0c0d":"#ffffff")})};m();document.addEventListener("DOMContentLoaded",m)}}catch(e){}})();`;

function apply(pref: ThemePreference) {
  const dark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  // Ручной выбор темы перекрывает системную: обе meta (light/dark) получают цвет выбранной темы
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute("content", dark ? "#0c0c0d" : "#ffffff");
  }
}

function read(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    const pref = read();
    setPreference(pref);
    apply(pref);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => read() === "system" && apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const set = useCallback((pref: ThemePreference) => {
    try {
      if (pref === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // приватный режим — тема просто не запомнится
    }
    setPreference(pref);
    apply(pref);
  }, []);

  return { preference, setPreference: set };
}
