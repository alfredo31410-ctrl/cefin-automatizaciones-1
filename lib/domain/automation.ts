import type { Automation, AutomationInput } from "./types";

export function sortTriggers<T extends { scheduledAt: string }>(triggers: T[]): T[] {
  return [...triggers].sort(
    (first, second) => new Date(first.scheduledAt).getTime() - new Date(second.scheduledAt).getTime(),
  );
}

export function getNextTrigger(automation: Automation) {
  return sortTriggers(automation.triggers).find(
    (trigger) => trigger.status === "PENDING" || trigger.status === "PROCESSING",
  );
}

export function validateAutomation(input: AutomationInput): string[] {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push("Escribe un nombre para la automatización.");
  if (!input.type) errors.push("Selecciona una etiqueta.");
  if (input.groupIds.length === 0) errors.push("Selecciona al menos un grupo.");
  if (input.triggers.length === 0) errors.push("Agrega al menos un disparo.");
  input.triggers.forEach((trigger, index) => {
    if (!trigger.content.trim()) errors.push(`El disparo #${index + 1} necesita un mensaje.`);
    if (!trigger.scheduledAt || Number.isNaN(new Date(trigger.scheduledAt).getTime())) {
      errors.push(`El disparo #${index + 1} necesita una fecha y hora válidas.`);
    }
  });
  return errors;
}

export function getDuplicateSchedules(input: AutomationInput): string[] {
  const counts = new Map<string, number>();
  for (const trigger of input.triggers) {
    if (trigger.scheduledAt) counts.set(trigger.scheduledAt, (counts.get(trigger.scheduledAt) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([date]) => date);
}
