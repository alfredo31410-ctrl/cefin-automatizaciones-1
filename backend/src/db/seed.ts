import { readEnvironment } from "../config/env.js";
import { createDatabaseConnection } from "./client.js";
import {
  automationGroups,
  automations,
  eventLogs,
  groups,
  lines,
  triggers,
  userLines,
  users,
} from "./schema.js";

const IDS = {
  user: "00000000-0000-4000-8000-000000000001",
  lines: {
    cefin: "10000000-0000-4000-8000-000000000001",
    cressara: "10000000-0000-4000-8000-000000000002",
    ebia: "10000000-0000-4000-8000-000000000003",
    doclevel: "10000000-0000-4000-8000-000000000004",
  },
  groups: {
    cefinProspectos: "20000000-0000-4000-8000-000000000001",
    cefinAlumnos: "20000000-0000-4000-8000-000000000002",
    cressaraInteresados: "20000000-0000-4000-8000-000000000003",
    cressaraClientes: "20000000-0000-4000-8000-000000000004",
    ebiaComunidad: "20000000-0000-4000-8000-000000000005",
    ebiaTaller: "20000000-0000-4000-8000-000000000006",
    doclevelLeads: "20000000-0000-4000-8000-000000000007",
    doclevelActivos: "20000000-0000-4000-8000-000000000008",
  },
  automations: {
    cefin: "30000000-0000-4000-8000-000000000001",
    cressara: "30000000-0000-4000-8000-000000000002",
    ebia: "30000000-0000-4000-8000-000000000003",
    doclevel: "30000000-0000-4000-8000-000000000004",
  },
} as const;

async function seed(): Promise<void> {
  const environment = readEnvironment();
  const connection = createDatabaseConnection(environment.DATABASE_URL);

  try {
    await connection.db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: IDS.user,
        email: "demo-tecnico@cefin.invalid",
        name: "Usuario técnico demo",
        passwordHash: "NOT_A_REAL_PASSWORD_HASH_V2_1A",
      }).onConflictDoNothing();

      const lineRows = [
        { id: IDS.lines.cefin, name: "CEFIN", slug: "cefin" },
        { id: IDS.lines.cressara, name: "Cressara", slug: "cressara" },
        { id: IDS.lines.ebia, name: "EBIA", slug: "ebia" },
        { id: IDS.lines.doclevel, name: "DocLevel", slug: "doclevel" },
      ];
      await tx.insert(lines).values(lineRows).onConflictDoNothing();

      await tx.insert(userLines).values(lineRows.map((line) => ({
        userId: IDS.user,
        lineId: line.id,
        role: "ADMIN" as const,
      }))).onConflictDoNothing();

      await tx.insert(groups).values([
        { id: IDS.groups.cefinProspectos, lineId: IDS.lines.cefin, name: "Prospectos Diplomados", memberCount: 184 },
        { id: IDS.groups.cefinAlumnos, lineId: IDS.lines.cefin, name: "Alumnos activos", memberCount: 96 },
        { id: IDS.groups.cressaraInteresados, lineId: IDS.lines.cressara, name: "Interesados Cressara", memberCount: 132 },
        { id: IDS.groups.cressaraClientes, lineId: IDS.lines.cressara, name: "Clientes Cressara", memberCount: 61 },
        { id: IDS.groups.ebiaComunidad, lineId: IDS.lines.ebia, name: "Comunidad EBIA", memberCount: 210 },
        { id: IDS.groups.ebiaTaller, lineId: IDS.lines.ebia, name: "Taller de ingreso", memberCount: 74 },
        { id: IDS.groups.doclevelLeads, lineId: IDS.lines.doclevel, name: "Leads DocLevel", memberCount: 143 },
        { id: IDS.groups.doclevelActivos, lineId: IDS.lines.doclevel, name: "Usuarios activos", memberCount: 88 },
      ]).onConflictDoNothing();

      await tx.insert(automations).values([
        { id: IDS.automations.cefin, lineId: IDS.lines.cefin, name: "Bienvenida Diplomados", type: "PREVENTA", status: "SCHEDULED", createdBy: IDS.user },
        { id: IDS.automations.cressara, lineId: IDS.lines.cressara, name: "Seguimiento de interesados", type: "RETARGETING", status: "DRAFT", createdBy: IDS.user },
        { id: IDS.automations.ebia, lineId: IDS.lines.ebia, name: "Calentamiento comunidad", type: "CALENTAMIENTO", status: "ACTIVE", createdBy: IDS.user, activatedAt: new Date("2026-01-10T15:00:00.000Z") },
        { id: IDS.automations.doclevel, lineId: IDS.lines.doclevel, name: "Conversión de prueba", type: "VENTA", status: "PAUSED", resumeStatus: "SCHEDULED", createdBy: IDS.user },
      ]).onConflictDoNothing();

      await tx.insert(automationGroups).values([
        { automationId: IDS.automations.cefin, groupId: IDS.groups.cefinProspectos, lineId: IDS.lines.cefin },
        { automationId: IDS.automations.cressara, groupId: IDS.groups.cressaraInteresados, lineId: IDS.lines.cressara },
        { automationId: IDS.automations.ebia, groupId: IDS.groups.ebiaComunidad, lineId: IDS.lines.ebia },
        { automationId: IDS.automations.doclevel, groupId: IDS.groups.doclevelLeads, lineId: IDS.lines.doclevel },
      ]).onConflictDoNothing();

      await tx.insert(triggers).values([
        { id: "40000000-0000-4000-8000-000000000001", automationId: IDS.automations.cefin, content: "Bienvenido a CEFIN. Tu sesión inicia pronto.", scheduledAt: new Date("2027-02-01T15:00:00.000Z") },
        { id: "40000000-0000-4000-8000-000000000002", automationId: IDS.automations.cressara, content: "¿Te gustaría conocer el siguiente paso?", scheduledAt: new Date("2027-02-02T17:00:00.000Z") },
        { id: "40000000-0000-4000-8000-000000000003", automationId: IDS.automations.ebia, content: "Contenido semanal para la comunidad EBIA.", scheduledAt: new Date("2026-01-10T15:00:00.000Z"), status: "SENT" },
        { id: "40000000-0000-4000-8000-000000000004", automationId: IDS.automations.doclevel, content: "Retoma tu prueba de DocLevel.", scheduledAt: new Date("2027-02-03T16:00:00.000Z") },
      ]).onConflictDoNothing();

      await tx.insert(eventLogs).values([
        { id: "50000000-0000-4000-8000-000000000001", lineId: IDS.lines.cefin, automationId: IDS.automations.cefin, userId: IDS.user, event: "SEED_CREATED", description: "Datos demo V2.1A creados" },
        { id: "50000000-0000-4000-8000-000000000002", lineId: IDS.lines.cressara, automationId: IDS.automations.cressara, userId: IDS.user, event: "SEED_CREATED", description: "Datos demo V2.1A creados" },
        { id: "50000000-0000-4000-8000-000000000003", lineId: IDS.lines.ebia, automationId: IDS.automations.ebia, userId: IDS.user, event: "SEED_CREATED", description: "Datos demo V2.1A creados" },
        { id: "50000000-0000-4000-8000-000000000004", lineId: IDS.lines.doclevel, automationId: IDS.automations.doclevel, userId: IDS.user, event: "SEED_CREATED", description: "Datos demo V2.1A creados" },
      ]).onConflictDoNothing();
    });

    console.log("Seed V2.1A completado");
  } finally {
    await connection.close();
  }
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falló el seed V2.1A");
  process.exit(1);
});
