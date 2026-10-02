import type { AppDatabase } from "./types";
import { slugifyLineName } from "./line";

export function validateAppDatabase(database: AppDatabase): string[] {
  const errors: string[] = [];
  if (!Array.isArray(database.lines) || database.lines.length === 0) errors.push("Debe existir al menos una línea.");
  if (!Array.isArray(database.groups)) errors.push("La colección de grupos es inválida.");
  if (!Array.isArray(database.automations)) errors.push("La colección de automatizaciones es inválida.");
  if (!Array.isArray(database.eventLogs)) errors.push("La colección de historial es inválida.");
  if (errors.length > 0) return errors;

  const lineIds = new Set<string>();
  const slugs = new Set<string>();
  for (const line of database.lines) {
    if (!line.id || !line.name.trim() || !line.slug) errors.push("Cada línea requiere id, nombre y slug.");
    if (lineIds.has(line.id)) errors.push(`El id de línea ${line.id} está duplicado.`);
    if (slugs.has(line.slug)) errors.push(`El slug de línea ${line.slug} está duplicado.`);
    if (line.slug !== slugifyLineName(line.slug)) errors.push(`El slug ${line.slug} no es seguro.`);
    lineIds.add(line.id);
    slugs.add(line.slug);
  }
  if (!database.lines.some((line) => line.active)) errors.push("No se puede dejar el sistema sin líneas activas.");

  const groupsById = new Map(database.groups.map((group) => [group.id, group]));
  for (const group of database.groups) {
    if (!group.lineId || !lineIds.has(group.lineId)) errors.push(`El grupo ${group.id} no pertenece a una línea válida.`);
  }
  for (const automation of database.automations) {
    if (!automation.lineId || !lineIds.has(automation.lineId)) errors.push(`La automatización ${automation.id} no pertenece a una línea válida.`);
    for (const groupId of automation.groupIds) {
      const group = groupsById.get(groupId);
      if (!group) errors.push(`La automatización ${automation.id} contiene el grupo inexistente ${groupId}.`);
      else if (group.lineId !== automation.lineId) errors.push(`La automatización ${automation.id} mezcla grupos de otra línea.`);
    }
  }
  for (const log of database.eventLogs) {
    if (!log.lineId || !lineIds.has(log.lineId)) errors.push(`El evento ${log.id} no pertenece a una línea válida.`);
    const automation = database.automations.find((item) => item.id === log.automationId);
    if (automation && automation.lineId !== log.lineId) errors.push(`El evento ${log.id} no coincide con la línea de su automatización.`);
  }
  return [...new Set(errors)];
}

export function assertValidAppDatabase(database: AppDatabase): void {
  const errors = validateAppDatabase(database);
  if (errors.length > 0) throw new Error(errors.join(" "));
}
