import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveActiveLineId } from "@/lib/domain/line";
import type { AppDatabase } from "@/lib/domain/types";
import { ACTIVE_LINE_COOKIE, ACTIVE_LINE_COOKIE_OPTIONS } from "@/lib/line-context";
import { appRepository } from "@/lib/repositories/json-app-repository";

async function responseWithContext(database: AppDatabase) {
  const requestedId = (await cookies()).get(ACTIVE_LINE_COOKIE)?.value;
  const selectedLineId = resolveActiveLineId(database.lines, requestedId);
  const response = NextResponse.json({ database, selectedLineId });
  if (requestedId !== selectedLineId) response.cookies.set(ACTIVE_LINE_COOKIE, selectedLineId, ACTIVE_LINE_COOKIE_OPTIONS);
  return response;
}

export async function GET() {
  return responseWithContext(await appRepository.getDatabase());
}

export async function PUT(request: Request) {
  try {
    const database = (await request.json()) as AppDatabase;
    return responseWithContext(await appRepository.saveDatabase(database));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Formato de datos inválido." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const { selectedLineId } = (await request.json()) as { selectedLineId?: string };
  const database = await appRepository.getDatabase();
  const line = database.lines.find((item) => item.id === selectedLineId && item.active);
  if (!line) return NextResponse.json({ error: "La línea seleccionada no está disponible." }, { status: 400 });
  const response = NextResponse.json({ selectedLineId: line.id });
  response.cookies.set(ACTIVE_LINE_COOKIE, line.id, ACTIVE_LINE_COOKIE_OPTIONS);
  return response;
}
