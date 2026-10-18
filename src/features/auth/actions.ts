"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SEC } from "./session";

export type LoginState = { error?: string };

const loginSchema = z.object({
  password: z.string().min(1, "Введите пароль").max(256),
  next: z.string().optional(),
});

function passwordMatches(input: string): boolean {
  const expected = process.env.APP_PASSWORD ?? "";
  if (!expected) return false;
  // Сравниваем хэши одинаковой длины за постоянное время
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Только относительные пути внутри приложения — защита от open redirect */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  if (!passwordMatches(parsed.data.password)) {
    await new Promise((r) => setTimeout(r, 600)); // замедляем перебор
    return { error: "Неверный пароль" };
  }

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
  redirect(safeNext(parsed.data.next));
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
