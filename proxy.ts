import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

function apiOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? null : "http://localhost:3001";
}

function clearSession(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", { expires: new Date(0), path: "/" });
  return response;
}

export async function proxy(request: NextRequest) {
  const isLogin = request.nextUrl.pathname === "/login";
  const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!session) return isLogin ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));

  const origin = apiOrigin();
  if (!origin) {
    return isLogin ? clearSession(NextResponse.next()) : clearSession(NextResponse.redirect(new URL("/login?reason=api", request.url)));
  }

  try {
    const response = await fetch(`${origin}/api/v1/auth/me`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (response.ok) return isLogin ? NextResponse.redirect(new URL("/dashboard", request.url)) : NextResponse.next();
  } catch {
    return isLogin ? NextResponse.next() : NextResponse.redirect(new URL("/login?reason=api", request.url));
  }

  return isLogin
    ? clearSession(NextResponse.next())
    : clearSession(NextResponse.redirect(new URL("/login?reason=session", request.url)));
}

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/automatizaciones/:path*", "/grupos/:path*", "/historial/:path*", "/lineas/:path*"],
};
