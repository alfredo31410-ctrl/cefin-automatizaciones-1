import { AppError } from "../domain/errors.js";
import type { LineRecord } from "../domain/types.js";
import type { AppRepository } from "../repositories/app-repository.js";

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export class LineService {
  constructor(private readonly repository: AppRepository) {}

  async create(name: string, actorId: string): Promise<LineRecord> {
    const slug = slugify(name);
    if (!slug) throw new AppError(400, "INVALID_LINE_NAME", "Escribe un nombre válido para la línea");
    return this.repository.createLine({ name: name.trim(), slug, active: true, actorId });
  }

  async update(id: string, input: { name?: string; active?: boolean }, actorId: string): Promise<LineRecord> {
    const current = await this.repository.getLine(id);
    if (!current) throw new AppError(404, "LINE_NOT_FOUND", "Línea no encontrada");
    const name = input.name?.trim() ?? current.name;
    const slug = input.name === undefined ? current.slug : slugify(name);
    if (!name || !slug) throw new AppError(400, "INVALID_LINE_NAME", "Escribe un nombre válido para la línea");
    return this.repository.updateLine(id, { name, slug, active: input.active, actorId });
  }
}
