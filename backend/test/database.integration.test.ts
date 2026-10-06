import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDatabaseConnection, type DatabaseConnection } from "../src/db/client.js";
import { automationGroups, automations, eventLogs, groups, lines, triggers } from "../src/db/schema.js";
import { PostgresWorkerRepository } from "../src/worker/postgres-worker-repository.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
let connection: DatabaseConnection | undefined;

describe.skipIf(!testDatabaseUrl)("PostgreSQL integration", () => {
  afterAll(async () => connection?.close());

  it("abre una conexión real", async () => {
    connection = createDatabaseConnection(testDatabaseUrl!);
    await expect(connection.healthCheck()).resolves.toBeUndefined();
  });

  it("dos reclamaciones concurrentes entregan cada trigger una sola vez", async () => {
    connection ??= createDatabaseConnection(testDatabaseUrl!);
    const lineId = randomUUID();
    const groupId = randomUUID();
    const automationId = randomUUID();
    const triggerId = randomUUID();
    const mexicoTenAm = new Date("2026-10-06T10:00:00-06:00");

    try {
      await connection.db.insert(lines).values({ id: lineId, name: "Worker integration", slug: `worker-${lineId}` });
      await connection.db.insert(groups).values({ id: groupId, lineId, name: "Worker group" });
      await connection.db.insert(automations).values({
        id: automationId,
        lineId,
        name: "Worker concurrency",
        type: "VENTA",
        status: "ACTIVE",
      });
      await connection.db.insert(automationGroups).values({ automationId, groupId, lineId });
      await connection.db.insert(triggers).values({
        id: triggerId,
        automationId,
        content: "Mensaje de integración",
        scheduledAt: mexicoTenAm,
      });

      const firstRepository = new PostgresWorkerRepository(connection.db);
      const secondRepository = new PostgresWorkerRepository(connection.db);
      await expect(firstRepository.claimDueTriggers(1, new Date(mexicoTenAm.getTime() - 1))).resolves.toHaveLength(0);
      const [first, second] = await Promise.all([
        firstRepository.claimDueTriggers(1, mexicoTenAm),
        secondRepository.claimDueTriggers(1, mexicoTenAm),
      ]);

      expect([...first, ...second].map(({ id }) => id)).toEqual([triggerId]);
      const [persisted] = await connection.db.select({ status: triggers.status }).from(triggers)
        .where(eq(triggers.id, triggerId));
      expect(persisted?.status).toBe("PROCESSING");
      const claimedEvents = await connection.db.select().from(eventLogs)
        .where(eq(eventLogs.automationId, automationId));
      expect(claimedEvents.filter(({ event }) => event === "TRIGGER_CLAIMED")).toHaveLength(1);
    } finally {
      await connection.db.delete(eventLogs).where(eq(eventLogs.automationId, automationId));
      await connection.db.delete(triggers).where(eq(triggers.automationId, automationId));
      await connection.db.delete(automationGroups).where(eq(automationGroups.automationId, automationId));
      await connection.db.delete(automations).where(eq(automations.id, automationId));
      await connection.db.delete(groups).where(eq(groups.id, groupId));
      await connection.db.delete(lines).where(eq(lines.id, lineId));
    }
  });
});
