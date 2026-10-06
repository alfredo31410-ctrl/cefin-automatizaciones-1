import { and, asc, eq, inArray, lte } from "drizzle-orm";
import type { AppDatabaseClient } from "../db/client.js";
import { automationGroups, automations, eventLogs, groups, triggers } from "../db/schema.js";
import type { GroupRecord } from "../domain/types.js";
import type { ClaimedTrigger, DeliveryContext, WorkerRepository } from "./types.js";

const PROCESSABLE_AUTOMATION_STATUSES = ["SCHEDULED", "ACTIVE"] as const;

function mapGroup(row: typeof groups.$inferSelect): GroupRecord {
  return row;
}

export class PostgresWorkerRepository implements WorkerRepository {
  constructor(private readonly db: AppDatabaseClient) {}

  async claimDueTriggers(limit: number, now: Date): Promise<ClaimedTrigger[]> {
    return this.db.transaction(async (tx) => {
      const candidates = await tx.select({
        id: triggers.id,
        automationId: triggers.automationId,
        lineId: automations.lineId,
        scheduledAt: triggers.scheduledAt,
      }).from(triggers).innerJoin(automations, eq(automations.id, triggers.automationId)).where(and(
        eq(triggers.status, "PENDING"),
        lte(triggers.scheduledAt, now),
        inArray(automations.status, PROCESSABLE_AUTOMATION_STATUSES),
      )).orderBy(asc(triggers.scheduledAt), asc(triggers.id)).limit(limit).for("update", {
        of: triggers,
        skipLocked: true,
      });

      if (candidates.length === 0) return [];

      const ids = candidates.map(({ id }) => id);
      const claimed = await tx.update(triggers).set({ status: "PROCESSING", updatedAt: now }).where(and(
        inArray(triggers.id, ids),
        eq(triggers.status, "PENDING"),
      )).returning({ id: triggers.id, automationId: triggers.automationId, scheduledAt: triggers.scheduledAt });

      const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      await tx.insert(eventLogs).values(claimed.map((trigger) => {
        const candidate = candidateById.get(trigger.id);
        if (!candidate) throw new Error("CLAIM_CONTEXT_MISSING");
        return {
          lineId: candidate.lineId,
          automationId: trigger.automationId,
          event: "TRIGGER_CLAIMED",
          description: "El Worker reclamó el disparo para procesamiento.",
          metadata: { triggerId: trigger.id, scheduledAt: trigger.scheduledAt.toISOString() },
          createdAt: now,
        };
      }));

      return claimed;
    });
  }

  async getDeliveryContext(triggerId: string): Promise<DeliveryContext | null> {
    const [row] = await this.db.select({
      triggerId: triggers.id,
      automationId: triggers.automationId,
      content: triggers.content,
      scheduledAt: triggers.scheduledAt,
      triggerStatus: triggers.status,
      attachmentMetadata: triggers.attachmentMetadata,
      lineId: automations.lineId,
      automationStatus: automations.status,
    }).from(triggers).innerJoin(automations, eq(automations.id, triggers.automationId))
      .where(eq(triggers.id, triggerId)).limit(1);
    if (!row) return null;

    const groupRows = await this.db.select({ group: groups }).from(automationGroups)
      .innerJoin(groups, eq(groups.id, automationGroups.groupId))
      .where(eq(automationGroups.automationId, row.automationId))
      .orderBy(asc(automationGroups.createdAt));

    return {
      trigger: {
        id: row.triggerId,
        automationId: row.automationId,
        content: row.content,
        scheduledAt: row.scheduledAt,
        status: row.triggerStatus,
        attachmentMetadata: row.attachmentMetadata ?? null,
      },
      automation: { id: row.automationId, lineId: row.lineId, status: row.automationStatus },
      groups: groupRows.map(({ group }) => mapGroup(group)),
    };
  }

  async markTriggerSent(triggerId: string, completedAt: Date): Promise<boolean> {
    return this.completeTrigger(triggerId, "SENT", completedAt);
  }

  async markTriggerFailed(triggerId: string, completedAt: Date, failureCode: string): Promise<boolean> {
    return this.completeTrigger(triggerId, "FAILED", completedAt, failureCode);
  }

  private async completeTrigger(
    triggerId: string,
    status: "SENT" | "FAILED",
    completedAt: Date,
    failureCode?: string,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx.update(triggers).set({ status, updatedAt: completedAt }).where(and(
        eq(triggers.id, triggerId),
        eq(triggers.status, "PROCESSING"),
      )).returning({ automationId: triggers.automationId });
      if (!updated) return false;

      const [automation] = await tx.select({ lineId: automations.lineId }).from(automations)
        .where(eq(automations.id, updated.automationId)).limit(1);
      if (!automation) throw new Error("AUTOMATION_CONTEXT_MISSING");

      await tx.insert(eventLogs).values({
        lineId: automation.lineId,
        automationId: updated.automationId,
        event: status === "SENT" ? "TRIGGER_SENT" : "TRIGGER_FAILED",
        description: status === "SENT"
          ? "El disparo fue procesado correctamente por MockMessagingProvider. No se envió ningún mensaje real."
          : "El disparo no pudo ser procesado por MockMessagingProvider.",
        metadata: { triggerId, ...(failureCode ? { failureCode } : {}) },
        createdAt: completedAt,
      });
      return true;
    });
  }
}
