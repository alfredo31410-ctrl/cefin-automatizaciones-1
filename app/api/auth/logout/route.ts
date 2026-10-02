import { NextResponse } from "next/server";
import { DEMO_COOKIE } from "@/lib/auth/demo-auth";
import { ACTIVE_LINE_COOKIE } from "@/lib/line-context";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
  response.cookies.set(ACTIVE_LINE_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
  return response;
}
