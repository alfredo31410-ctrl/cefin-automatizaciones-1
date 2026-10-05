import type { AutomationStatus, AutomationType, EventType, TriggerStatus } from "./types";

export const APP_TIME_ZONE = "America/Mexico_City";
export const MEXICO_CITY_OFFSET = "-06:00";

export const AUTOMATION_TYPES: Record<AutomationType, { label: string; className: string }> = {
  PREVENTA: { label: "Preventa", className: "badge-cyan" },
  VENTA: { label: "Venta", className: "badge-violet" },
  RETARGETING: { label: "Retargeting", className: "badge-amber" },
  CALENTAMIENTO: { label: "Calentamiento", className: "badge-rose" },
};

export const AUTOMATION_STATUSES: Record<AutomationStatus, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "status-neutral" },
  SCHEDULED: { label: "Programada", className: "status-blue" },
  ACTIVE: { label: "Activa", className: "status-green" },
  PAUSED: { label: "Pausada", className: "status-amber" },
  COMPLETED: { label: "Finalizada", className: "status-violet" },
  ERROR: { label: "Error", className: "status-red" },
  CANCELLED: { label: "Cancelada", className: "status-neutral" },
};

export const TRIGGER_STATUSES: Record<TriggerStatus, { label: string; className: string }> = {
  PENDING: { label: "Pendiente", className: "status-blue" },
  PROCESSING: { label: "Procesando", className: "status-amber" },
  SENT: { label: "Enviado", className: "status-green" },
  FAILED: { label: "Fallido", className: "status-red" },
  CANCELLED: { label: "Cancelado", className: "status-neutral" },
};

export const EVENT_LABELS: Record<EventType, string> = {
  AUTOMATION_CREATED: "Automatización creada",
  AUTOMATION_UPDATED: "Automatización actualizada",
  AUTOMATION_ACTIVATED: "Automatización activada",
  AUTOMATION_PAUSED: "Automatización pausada",
  AUTOMATION_RESUMED: "Automatización reactivada",
  AUTOMATION_DUPLICATED: "Automatización duplicada",
  AUTOMATION_CANCELLED: "Automatización cancelada",
  TRIGGER_SIMULATED_SENT: "Envío simulado exitoso",
  TRIGGER_SIMULATED_FAILED: "Envío simulado fallido",
  LINE_CREATED: "Línea creada",
  LINE_UPDATED: "Línea actualizada",
  SEED_CREATED: "Datos iniciales creados",
};
