import type { Line } from "./types";

export function slugifyLineName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveActiveLineId(lines: Line[], requestedId?: string): string {
  const requested = lines.find((line) => line.id === requestedId && line.active);
  const fallback = requested ?? lines.find((line) => line.active);
  if (!fallback) throw new Error("Debe existir al menos una línea activa.");
  return fallback.id;
}
