import { NextResponse } from "next/server";
import type { AppDatabase } from "@/lib/domain/types";
import { appRepository } from "@/lib/repositories/json-app-repository";

export async function GET() {
  return NextResponse.json(await appRepository.getDatabase());
}

export async function PUT(request: Request) {
  const database = (await request.json()) as AppDatabase;
  if (!Array.isArray(database.automations) || !Array.isArray(database.groups) || !Array.isArray(database.eventLogs)) {
    return NextResponse.json({ error: "Formato de datos inválido." }, { status: 400 });
  }
  return NextResponse.json(await appRepository.saveDatabase(database));
}
