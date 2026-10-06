import { NextResponse } from "next/server";
import { expiredSessionCookieOptions, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";

export const dynamic = "force-dynamic";

function apiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3001";
  throw new Error("NEXT_PUBLIC_API_URL no está configurada");
}

async function forward(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    if (path[0] !== "api" || path[1] !== "v1") {
      return NextResponse.json({ error: { code: "ROUTE_NOT_ALLOWED", message: "Ruta no permitida" } }, { status: 404 });
    }

    const url = `${apiBaseUrl()}/${path.map(encodeURIComponent).join("/")}`;
    const headers = new Headers({ accept: "application/json" });
    const contentType = request.headers.get("content-type");
    const cookie = request.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);

    const requestBody = request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
    const hasBody = requestBody !== undefined && requestBody.byteLength > 0;
    if (hasBody && contentType) headers.set("content-type", contentType);
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body: hasBody ? requestBody : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });

    const responseHeaders = new Headers();
    responseHeaders.set("content-type", upstream.headers.get("content-type") ?? "application/json; charset=utf-8");
    for (const value of upstream.headers.getSetCookie()) responseHeaders.append("set-cookie", value);
    const response = new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
    if (upstream.ok && path.join("/") === "api/v1/auth/logout") {
      response.cookies.set(SESSION_COOKIE_NAME, "", expiredSessionCookieOptions());
    }
    return response;
  } catch {
    return NextResponse.json({
      error: { code: "API_UNAVAILABLE", message: "La API no está disponible en este momento" },
    }, { status: 503 });
  }
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
