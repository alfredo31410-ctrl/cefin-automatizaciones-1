import { NextRequest, NextResponse } from "next/server";
import { DEMO_COOKIE, DEMO_SESSION_VALUE } from "@/lib/auth/demo-auth";

export function proxy(request: NextRequest) {
  const authenticated = request.cookies.get(DEMO_COOKIE)?.value === DEMO_SESSION_VALUE;
  const isLogin = request.nextUrl.pathname === "/login";
  const isPublicApi = request.nextUrl.pathname.startsWith("/api/auth/");

  if (!authenticated && !isLogin && !isPublicApi) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (authenticated && isLogin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
