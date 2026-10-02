import type { AppDatabase, Automation, AutomationStatus, AutomationType, Group, TriggerStatus } from "@/lib/domain/types";

const now = new Date();
const at = (dayOffset: number, hour: number, minute = 0) => {
  const date = new Date(now);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const groupNames = [
  "Master IA 01",
  "Master IA 02",
  "Master IA 03",
  "Contabilidad Electrónica 01",
  "Contabilidad Electrónica 02",
  "Estratega Fiscal 01",
  "Estratega Fiscal 02",
  "Primeras Horas Bebé 01",
];

const groups: Group[] = groupNames.map((name, index) => ({
  id: `group-${index + 1}`,
  name,
  externalId: `demo-fc-${String(index + 1).padStart(3, "0")}`,
  memberCount: 118 + index * 37,
  active: index !== 7,
  createdAt: at(-60 + index, 9),
}));

function automation(
  id: string,
  name: string,
  type: AutomationType,
  status: AutomationStatus,
  groupIds: string[],
  messages: Array<[number, number, string, TriggerStatus]>,
): Automation {
  return {
    id,
    name,
    type,
    status,
    groupIds,
    triggers: messages.map(([days, hour, content, triggerStatus], index) => ({
      id: `${id}-trigger-${index + 1}`,
      automationId: id,
      content,
      scheduledAt: at(days, hour),
      status: triggerStatus,
      createdAt: at(-12, 10),
      updatedAt: at(days < 0 ? days : -2, hour),
    })),
    createdAt: at(-14, 10),
    updatedAt: at(-1, 16),
    activatedAt: status !== "DRAFT" ? at(-10, 11) : undefined,
    finishedAt: status === "COMPLETED" ? at(-1, 18) : undefined,
    resumeStatus: status === "PAUSED" ? "ACTIVE" : undefined,
  };
}

const automations: Automation[] = [
  automation("automation-master-ia", "Master IA — Venta octubre", "VENTA", "ACTIVE", ["group-1", "group-2", "group-3"], [
    [-1, 10, "Hoy abrimos inscripciones para Master IA. Conoce el programa y resuelve tus dudas con nuestro equipo.", "SENT"],
    [0, 17, "La sesión informativa comienza hoy. Te compartimos los puntos clave para aprovecharla al máximo.", "PENDING"],
    [2, 12, "Últimos lugares disponibles para esta generación de Master IA.", "PENDING"],
  ]),
  automation("automation-contabilidad", "Contabilidad Electrónica — Preventa", "PREVENTA", "SCHEDULED", ["group-4", "group-5"], [
    [1, 9, "Estamos preparando una actualización práctica sobre Contabilidad Electrónica para tu despacho.", "PENDING"],
    [3, 18, "Mañana compartiremos el temario y beneficios de la nueva capacitación.", "PENDING"],
  ]),
  automation("automation-estratega", "Estratega Fiscal — Seguimiento", "RETARGETING", "PAUSED", ["group-6", "group-7"], [
    [-2, 11, "¿Te quedaste con dudas sobre Estratega Fiscal? Aquí tienes un resumen de la propuesta.", "SENT"],
    [2, 16, "Nuestro equipo puede ayudarte a elegir la modalidad más conveniente.", "PENDING"],
  ]),
  automation("automation-calienta", "Comunidad CEFIN — Calentamiento", "CALENTAMIENTO", "DRAFT", ["group-1", "group-4", "group-6"], [
    [5, 10, "Esta semana compartiremos recursos creados para fortalecer tu práctica profesional.", "PENDING"],
  ]),
  automation("automation-cierre", "Master IA — Cierre septiembre", "VENTA", "COMPLETED", ["group-1", "group-2"], [
    [-4, 9, "Comenzamos el último día de inscripciones para Master IA.", "SENT"],
    [-3, 18, "Inscripciones cerradas. Gracias por acompañarnos en esta generación.", "SENT"],
  ]),
];

export function createDemoDatabase(): AppDatabase {
  return {
    groups,
    automations,
    eventLogs: [
      { id: "log-1", automationId: "automation-master-ia", automationName: "Master IA — Venta octubre", type: "AUTOMATION_ACTIVATED", description: "Se activó la secuencia con 3 grupos y 3 disparos.", createdAt: at(-10, 11) },
      { id: "log-2", automationId: "automation-master-ia", automationName: "Master IA — Venta octubre", type: "TRIGGER_SIMULATED_SENT", description: "El disparo #1 se marcó como enviado en la simulación local.", createdAt: at(-1, 10) },
      { id: "log-3", automationId: "automation-contabilidad", automationName: "Contabilidad Electrónica — Preventa", type: "AUTOMATION_ACTIVATED", description: "Se programó la automatización para 2 grupos.", createdAt: at(-4, 12) },
      { id: "log-4", automationId: "automation-estratega", automationName: "Estratega Fiscal — Seguimiento", type: "AUTOMATION_PAUSED", description: "La automatización se pausó manualmente.", createdAt: at(-1, 16) },
      { id: "log-5", automationId: "automation-calienta", automationName: "Comunidad CEFIN — Calentamiento", type: "AUTOMATION_CREATED", description: "Se guardó una nueva automatización como borrador.", createdAt: at(-2, 13) },
      { id: "log-6", automationId: "automation-cierre", automationName: "Master IA — Cierre septiembre", type: "TRIGGER_SIMULATED_SENT", description: "El último disparo finalizó correctamente en modo simulación.", createdAt: at(-3, 18) },
    ],
    version: 1,
  };
}
