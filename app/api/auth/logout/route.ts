import { NextResponse } from "next/server";
import { DEMO_COOKIE } from "@/lib/auth/demo-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
  return response;
}
