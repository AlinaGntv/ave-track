import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/features/auth/session";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authed = token ? await verifySessionToken(token) : false;
  const isLogin = pathname === "/login";

  if (authed && isLogin) return NextResponse.redirect(new URL("/", req.url));
  if (authed || isLogin) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Статика, иконки и PWA-файлы доступны без входа
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|icons/|manifest\\.webmanifest|sw\\.js|offline\\.html|.*\\.(?:png|svg|ico|jpg|webp)$).*)",
  ],
};
