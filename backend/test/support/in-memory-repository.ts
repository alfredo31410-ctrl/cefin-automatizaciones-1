import { randomUUID } from "node:crypto";
import type {
  AutomationRecord,
  AutomationWrite,
  EventLogRecord,
  GroupRecord,
  LineRecord,
} from "../../src/domain/types.js";
import type { AppRepository, StatusTransition } from "../../src/repositories/app-repository.js";

export const FIXTURE_IDS = {
  lineA: "10000000-0000-4000-8000-000000000001",
  lineB: "10000000-0000-4000-8000-000000000002",
  groupA: "20000000-0000-4000-8000-000000000001",
  groupB: "20000000-0000-4000-8000-000000000002",
} as const;

export class InMemoryAppRepository implements AppRepository {
  readonly lines: LineRecord[];
  readonly groups: GroupRecord[];
  readonly automations: AutomationRecord[] = [];
  readonly events: EventLogRecord[] = [];

  constructor() {
    const now = new Date("2026-01-01T00:00:00.000Z");
    this.lines = [
      { id: FIXTURE_IDS.lineA, name: "CEFIN", slug: "cefin", active: true, createdAt: now, updatedAt: now },
      { id: FIXTURE_IDS.lineB, name: "EBIA", slug: "ebia", active: true, createdAt: now, updatedAt: now },
    ];
    this.groups = [
      { id: FIXTURE_IDS.groupA, lineId: FIXTURE_IDS.lineA, name: "Grupo A", externalId: null, memberCount: 10, active: true, createdAt: now, updatedAt: now },
      { id: FIXTURE_IDS.groupB, lineId: FIXTURE_IDS.lineB, name: "Grupo B", externalId: null, memberCount: 20, active: true, createdAt: now, updatedAt: now },
    ];
  }

  async listLines(): Promise<LineRecord[]> { return this.lines; }
  async getLine(id: string): Promise<LineRecord | null> { return this.lines.find((line) => line.id === id) ?? null; }
  async listGroups(lineId: string): Promise<GroupRecord[]> { return this.groups.filter((group) => group.lineId === lineId); }
  async getGroupsByIds(ids: string[]): Promise<GroupRecord[]> { return this.groups.filter((group) => ids.includes(group.id)); }
  async listAutomations(lineId: string): Promise<AutomationRecord[]> { return this.automations.filter((automation) => automation.lineId === lineId); }
  async getAutomation(id: string): Promise<AutomationRecord | null> { return this.automations.find((automation) => automation.id === id) ?? null; }

  async createAutomation(input: AutomationWrite): Promise<AutomationRecord> {
    const now = new Date();
    const id = input.id ?? randomUUID();
    const automation: AutomationRecord = {
      id,
      lineId: input.lineId,
      name: input.name,
      type: input.type,
      status: input.status,
      createdBy: input.createdBy ?? null,
      groupIds: [...input.groupIds],
      triggers: input.triggers.map((trigger) => ({
        id: trigger.id ?? randomUUID(),
        automationId: id,
        content: trigger.content,
        scheduledAt: trigger.scheduledAt,
        status: trigger.status ?? "PENDING",
        attachmentMetadata: trigger.attachmentMetadata ?? null,
        createdAt: now,
        updatedAt: now,
      })),
      createdAt: now,
      updatedAt: now,
      activatedAt: input.activatedAt ?? null,
      finishedAt: input.finishedAt ?? null,
      resumeStatus: input.resumeStatus ?? null,
    };
    this.automations.push(automation);
    this.recordEvent(automation, input.event, input.eventDescription, input.eventMetadata);
    return automation;
  }

  async updateAutomation(id: string, input: AutomationWrite): Promise<AutomationRecord> {
    const index = this.automations.findIndex((automation) => automation.id === id);
    if (index < 0) throw new Error("not found");
    const current = this.automations[index];
    const updated: AutomationRecord = {
      ...current,
      name: input.name,
      type: input.type,
      status: input.status,
      groupIds: [...input.groupIds],
      triggers: input.triggers.map((trigger) => ({
        id: trigger.id ?? randomUUID(),
        automationId: id,
        content: trigger.content,
        scheduledAt: trigger.scheduledAt,
        status: trigger.status ?? "PENDING",
        attachmentMetadata: trigger.attachmentMetadata ?? null,
        createdAt: current.createdAt,
        updatedAt: new Date(),
      })),
      updatedAt: new Date(),
    };
    this.automations[index] = updated;
    this.recordEvent(updated, input.event, input.eventDescription, input.eventMetadata);
    return updated;
  }

  async transitionAutomation(id: string, input: StatusTransition): Promise<AutomationRecord> {
    const automation = await this.getAutomation(id);
    if (!automation) throw new Error("not found");
    automation.status = input.status;
    if (input.resumeStatus !== undefined) automation.resumeStatus = input.resumeStatus;
    if (input.activatedAt !== undefined) automation.activatedAt = input.activatedAt;
    if (input.finishedAt !== undefined) automation.finishedAt = input.finishedAt;
    if (input.cancelPendingTriggers) {
      automation.triggers.forEach((trigger) => {
        if (trigger.status === "PENDING") trigger.status = "CANCELLED";
      });
    }
    automation.updatedAt = new Date();
    this.recordEvent(automation, input.event, input.description, input.metadata);
    return automation;
  }

  async listEvents(lineId: string): Promise<EventLogRecord[]> { return this.events.filter((event) => event.lineId === lineId); }

  private recordEvent(automation: AutomationRecord, event: string, description: string, metadata?: Record<string, unknown> | null): void {
    this.events.push({
      id: randomUUID(),
      lineId: automation.lineId,
      automationId: automation.id,
      userId: automation.createdBy,
      event,
      description,
      metadata: metadata ?? null,
      createdAt: new Date(),
    });
  }
}
