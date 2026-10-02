import { NextResponse } from "next/server";
import { DEMO_COOKIE, DEMO_EMAIL, DEMO_PASSWORD, DEMO_SESSION_VALUE, DEMO_USER } from "@/lib/auth/demo-auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  if (body.email?.toLowerCase() !== DEMO_EMAIL || body.password !== DEMO_PASSWORD) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  }
  const response = NextResponse.json({ user: DEMO_USER });
  response.cookies.set(DEMO_COOKIE, DEMO_SESSION_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
