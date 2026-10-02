import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { AppDatabaseClient } from "../db/client.js";
import {
  automationGroups,
  automations,
  eventLogs,
  groups,
  lines,
  triggers,
} from "../db/schema.js";
import { AppError, isPgUniqueViolation } from "../domain/errors.js";
import type {
  AutomationRecord,
  AutomationWrite,
  EventLogRecord,
  GroupRecord,
  LineRecord,
  TriggerRecord,
} from "../domain/types.js";
import type { AppRepository, StatusTransition } from "./app-repository.js";

type AutomationRow = typeof automations.$inferSelect;
type TriggerRow = typeof triggers.$inferSelect;

function mapLine(row: typeof lines.$inferSelect): LineRecord {
  return row;
}

function mapGroup(row: typeof groups.$inferSelect): GroupRecord {
  return row;
}

function mapTrigger(row: TriggerRow): TriggerRecord {
  return {
    ...row,
    attachmentMetadata: row.attachmentMetadata ?? null,
  };
}

function mapEvent(row: typeof eventLogs.$inferSelect): EventLogRecord {
  return {
    ...row,
    metadata: row.metadata ?? null,
  };
}

function mapAutomation(row: AutomationRow, groupIds: string[], triggerRows: TriggerRow[]): AutomationRecord {
  return {
    ...row,
    createdBy: row.createdBy ?? null,
    activatedAt: row.activatedAt ?? null,
    finishedAt: row.finishedAt ?? null,
    resumeStatus: row.resumeStatus as "ACTIVE" | "SCHEDULED" | null,
    groupIds,
    triggers: triggerRows.map(mapTrigger),
  };
}

export class PostgresAppRepository implements AppRepository {
  constructor(private readonly db: AppDatabaseClient) {}

  async listLines(): Promise<LineRecord[]> {
    const rows = await this.db.select().from(lines).orderBy(asc(lines.name));
    return rows.map(mapLine);
  }

  async getLine(id: string): Promise<LineRecord | null> {
    const [row] = await this.db.select().from(lines).where(eq(lines.id, id)).limit(1);
    return row ? mapLine(row) : null;
  }

  async listGroups(lineId: string): Promise<GroupRecord[]> {
    const rows = await this.db.select().from(groups).where(eq(groups.lineId, lineId)).orderBy(asc(groups.name));
    return rows.map(mapGroup);
  }

  async getGroupsByIds(ids: string[]): Promise<GroupRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.select().from(groups).where(inArray(groups.id, ids));
    return rows.map(mapGroup);
  }

  async listAutomations(lineId: string): Promise<AutomationRecord[]> {
    const rows = await this.db.select().from(automations).where(eq(automations.lineId, lineId)).orderBy(desc(automations.createdAt));
    return Promise.all(rows.map((row) => this.hydrateAutomation(row)));
  }

  async getAutomation(id: string): Promise<AutomationRecord | null> {
    const [row] = await this.db.select().from(automations).where(eq(automations.id, id)).limit(1);
    return row ? this.hydrateAutomation(row) : null;
  }

  async createAutomation(input: AutomationWrite): Promise<AutomationRecord> {
    try {
      const id = await this.db.transaction(async (tx) => {
        const [row] = await tx.insert(automations).values({
          ...(input.id ? { id: input.id } : {}),
          lineId: input.lineId,
          name: input.name,
          type: input.type,
          status: input.status,
          createdBy: input.createdBy ?? null,
          activatedAt: input.activatedAt ?? null,
          finishedAt: input.finishedAt ?? null,
          resumeStatus: input.resumeStatus ?? null,
        }).returning({ id: automations.id });

        if (!row) throw new AppError(500, "INSERT_FAILED", "No se pudo crear la automatización");

        if (input.groupIds.length > 0) {
          await tx.insert(automationGroups).values(input.groupIds.map((groupId) => ({
            automationId: row.id,
            groupId,
            lineId: input.lineId,
          })));
        }

        if (input.triggers.length > 0) {
          await tx.insert(triggers).values(input.triggers.map((trigger) => ({
            ...(trigger.id ? { id: trigger.id } : {}),
            automationId: row.id,
            content: trigger.content,
            scheduledAt: trigger.scheduledAt,
            status: trigger.status ?? "PENDING",
            attachmentMetadata: trigger.attachmentMetadata ?? null,
          })));
        }

        await tx.insert(eventLogs).values({
          lineId: input.lineId,
          automationId: row.id,
          userId: input.createdBy ?? null,
          event: input.event,
          description: input.eventDescription,
          metadata: input.eventMetadata ?? null,
        });

        return row.id;
      });

      return await this.requireHydrated(id);
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async updateAutomation(id: string, input: AutomationWrite): Promise<AutomationRecord> {
    try {
      await this.db.transaction(async (tx) => {
        const [updated] = await tx.update(automations).set({
          name: input.name,
          type: input.type,
          status: input.status,
          activatedAt: input.activatedAt ?? null,
          finishedAt: input.finishedAt ?? null,
          resumeStatus: input.resumeStatus ?? null,
          updatedAt: new Date(),
        }).where(eq(automations.id, id)).returning({ id: automations.id });

        if (!updated) throw new AppError(404, "AUTOMATION_NOT_FOUND", "Automatización no encontrada");

        await tx.delete(automationGroups).where(eq(automationGroups.automationId, id));
        if (input.groupIds.length > 0) {
          await tx.insert(automationGroups).values(input.groupIds.map((groupId) => ({
            automationId: id,
            groupId,
            lineId: input.lineId,
          })));
        }

        await tx.delete(triggers).where(eq(triggers.automationId, id));
        if (input.triggers.length > 0) {
          await tx.insert(triggers).values(input.triggers.map((trigger) => ({
            ...(trigger.id ? { id: trigger.id } : {}),
            automationId: id,
            content: trigger.content,
            scheduledAt: trigger.scheduledAt,
            status: trigger.status ?? "PENDING",
            attachmentMetadata: trigger.attachmentMetadata ?? null,
          })));
        }

        await tx.insert(eventLogs).values({
          lineId: input.lineId,
          automationId: id,
          userId: input.createdBy ?? null,
          event: input.event,
          description: input.eventDescription,
          metadata: input.eventMetadata ?? null,
        });
      });

      return await this.requireHydrated(id);
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async transitionAutomation(id: string, input: StatusTransition): Promise<AutomationRecord> {
    await this.db.transaction(async (tx) => {
      const values: {
        status: StatusTransition["status"];
        updatedAt: Date;
        resumeStatus?: "ACTIVE" | "SCHEDULED" | null;
        activatedAt?: Date | null;
        finishedAt?: Date | null;
      } = { status: input.status, updatedAt: new Date() };

      if (input.resumeStatus !== undefined) values.resumeStatus = input.resumeStatus;
      if (input.activatedAt !== undefined) values.activatedAt = input.activatedAt;
      if (input.finishedAt !== undefined) values.finishedAt = input.finishedAt;

      const [updated] = await tx.update(automations).set(values).where(eq(automations.id, id)).returning({
        lineId: automations.lineId,
        createdBy: automations.createdBy,
      });
      if (!updated) throw new AppError(404, "AUTOMATION_NOT_FOUND", "Automatización no encontrada");

      if (input.cancelPendingTriggers) {
        await tx.update(triggers).set({ status: "CANCELLED", updatedAt: new Date() }).where(and(
          eq(triggers.automationId, id),
          eq(triggers.status, "PENDING"),
        ));
      }

      await tx.insert(eventLogs).values({
        lineId: updated.lineId,
        automationId: id,
        userId: updated.createdBy,
        event: input.event,
        description: input.description,
        metadata: input.metadata ?? null,
      });
    });

    return this.requireHydrated(id);
  }

  async listEvents(lineId: string): Promise<EventLogRecord[]> {
    const rows = await this.db.select().from(eventLogs).where(eq(eventLogs.lineId, lineId)).orderBy(desc(eventLogs.createdAt));
    return rows.map(mapEvent);
  }

  private async hydrateAutomation(row: AutomationRow): Promise<AutomationRecord> {
    const [groupRows, triggerRows] = await Promise.all([
      this.db.select({ groupId: automationGroups.groupId }).from(automationGroups)
        .where(eq(automationGroups.automationId, row.id)).orderBy(asc(automationGroups.createdAt)),
      this.db.select().from(triggers).where(eq(triggers.automationId, row.id)).orderBy(asc(triggers.scheduledAt)),
    ]);
    return mapAutomation(row, groupRows.map(({ groupId }) => groupId), triggerRows);
  }

  private async requireHydrated(id: string): Promise<AutomationRecord> {
    const automation = await this.getAutomation(id);
    if (!automation) throw new AppError(500, "PERSISTENCE_ERROR", "La automatización guardada no se pudo recuperar");
    return automation;
  }

  private rethrowDatabaseError(error: unknown): never {
    if (error instanceof AppError) throw error;
    if (isPgUniqueViolation(error)) {
      throw new AppError(409, "DUPLICATE_VALUE", "Ya existe un registro con esos datos");
    }
    throw error;
  }
}
