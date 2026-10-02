import type { AppDatabase, Automation, AutomationStatus, AutomationType, EventLog, Group, Line, TriggerStatus } from "@/lib/domain/types";

const now = new Date();
const at = (dayOffset: number, hour: number, minute = 0) => {
  const date = new Date(now);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const lines: Line[] = [
  { id: "line-cefin", name: "CEFIN", slug: "cefin", active: true, createdAt: at(-120, 9), updatedAt: at(-120, 9) },
  { id: "line-cressara", name: "Cressara", slug: "cressara", active: true, createdAt: at(-110, 9), updatedAt: at(-110, 9) },
  { id: "line-ebia", name: "EBIA", slug: "ebia", active: true, createdAt: at(-100, 9), updatedAt: at(-100, 9) },
  { id: "line-doclevel", name: "DocLevel", slug: "doclevel", active: true, createdAt: at(-90, 9), updatedAt: at(-90, 9) },
];

const groupSeed: Array<[string, string, string, number]> = [
  ["group-cefin-master-1", "line-cefin", "Master IA 01", 238],
  ["group-cefin-master-2", "line-cefin", "Master IA 02", 191],
  ["group-cefin-contabilidad-1", "line-cefin", "Contabilidad Electrónica 01", 264],
  ["group-cefin-estratega-1", "line-cefin", "Estratega Fiscal 01", 176],
  ["group-cressara-1", "line-cressara", "Cressara 01", 143],
  ["group-cressara-2", "line-cressara", "Cressara 02", 127],
  ["group-ebia-1", "line-ebia", "EBIA 01", 156],
  ["group-ebia-2", "line-ebia", "EBIA 02", 132],
  ["group-doclevel-bebe-1", "line-doclevel", "Primeras Horas Bebé 01", 209],
  ["group-doclevel-bebe-2", "line-doclevel", "Primeras Horas Bebé 02", 184],
];

const groups: Group[] = groupSeed.map(([id, lineId, name, memberCount], index) => ({
  id,
  lineId,
  name,
  externalId: `mock-${lineId.replace("line-", "")}-${String(index + 1).padStart(2, "0")}`,
  memberCount,
  active: true,
  createdAt: at(-80 + index, 9),
}));

function automation(
  id: string,
  lineId: string,
  name: string,
  type: AutomationType,
  status: AutomationStatus,
  groupIds: string[],
  messages: Array<[number, number, string, TriggerStatus]>,
): Automation {
  return {
    id,
    lineId,
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
  automation("automation-master-ia", "line-cefin", "Master IA — Venta", "VENTA", "ACTIVE", ["group-cefin-master-1", "group-cefin-master-2"], [
    [-1, 10, "Hoy abrimos inscripciones para Master IA. Conoce el programa y resuelve tus dudas con nuestro equipo.", "SENT"],
    [0, 17, "La sesión informativa comienza hoy. Te compartimos los puntos clave para aprovecharla al máximo.", "PENDING"],
    [2, 12, "Últimos lugares disponibles para esta generación de Master IA.", "PENDING"],
  ]),
  automation("automation-contabilidad", "line-cefin", "Contabilidad Electrónica — Preventa", "PREVENTA", "SCHEDULED", ["group-cefin-contabilidad-1"], [
    [1, 9, "Estamos preparando una actualización práctica sobre Contabilidad Electrónica para tu despacho.", "PENDING"],
    [3, 18, "Mañana compartiremos el temario y beneficios de la nueva capacitación.", "PENDING"],
  ]),
  automation("automation-cefin-retarget", "line-cefin", "Estratega Fiscal — Seguimiento", "RETARGETING", "PAUSED", ["group-cefin-estratega-1"], [
    [-2, 11, "¿Te quedaste con dudas sobre Estratega Fiscal? Aquí tienes un resumen de la propuesta.", "SENT"],
    [2, 16, "Nuestro equipo puede ayudarte a elegir la modalidad más conveniente.", "PENDING"],
  ]),
  automation("automation-cressara", "line-cressara", "Cressara — Calentamiento", "CALENTAMIENTO", "ACTIVE", ["group-cressara-1", "group-cressara-2"], [
    [-1, 12, "Conoce las ideas que guían a la comunidad Cressara y acompáñanos en esta nueva etapa.", "SENT"],
    [1, 12, "Mañana compartiremos una sesión especial para la comunidad Cressara.", "PENDING"],
  ]),
  automation("automation-ebia", "line-ebia", "EBIA — Preventa", "PREVENTA", "SCHEDULED", ["group-ebia-1", "group-ebia-2"], [
    [2, 10, "Estamos preparando una experiencia EBIA diseñada para convertir conocimiento en acción.", "PENDING"],
    [4, 10, "Descubre antes que nadie el programa y los beneficios de la próxima edición EBIA.", "PENDING"],
  ]),
  automation("automation-doclevel", "line-doclevel", "Primeras Horas Bebé — Retargeting", "RETARGETING", "ACTIVE", ["group-doclevel-bebe-1", "group-doclevel-bebe-2"], [
    [-2, 9, "Retoma la guía de Primeras Horas Bebé y revisa los recursos que preparamos para ti.", "SENT"],
    [1, 9, "Aún puedes resolver tus dudas y acceder al acompañamiento de Primeras Horas Bebé.", "PENDING"],
  ]),
  automation("automation-doclevel-warm", "line-doclevel", "DocLevel — Comunidad", "CALENTAMIENTO", "DRAFT", ["group-doclevel-bebe-1"], [
    [5, 11, "Esta semana compartiremos herramientas prácticas para acompañar los primeros días del bebé.", "PENDING"],
  ]),
];

const eventLogs: EventLog[] = automations.map((item, index) => ({
  id: `log-demo-${index + 1}`,
  lineId: item.lineId,
  automationId: item.id,
  automationName: item.name,
  type: item.status === "DRAFT" ? "AUTOMATION_CREATED" : item.status === "PAUSED" ? "AUTOMATION_PAUSED" : "AUTOMATION_ACTIVATED",
  description: item.status === "DRAFT" ? "Se guardó como borrador en el entorno local." : item.status === "PAUSED" ? "La automatización se pausó manualmente." : `Se configuró para ${item.groupIds.length} grupo${item.groupIds.length === 1 ? "" : "s"} en modo simulación.`,
  createdAt: at(-7 + index, 11),
}));

export function createDemoDatabase(): AppDatabase {
  return { lines, groups, automations, eventLogs, version: 1, schemaVersion: 2 };
}
