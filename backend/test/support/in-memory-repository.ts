import { randomUUID } from "node:crypto";
import type {
  AutomationRecord,
  AutomationWrite,
  EventLogRecord,
  GroupRecord,
  LineWrite,
  LineRecord,
  SessionPrincipal,
  UserRecord,
} from "../../src/domain/types.js";
import type { AppRepository, StatusTransition } from "../../src/repositories/app-repository.js";
import type { AuthRepository, CreateSessionInput } from "../../src/repositories/auth-repository.js";

export const FIXTURE_IDS = {
  lineA: "10000000-0000-4000-8000-000000000001",
  lineB: "10000000-0000-4000-8000-000000000002",
  groupA: "20000000-0000-4000-8000-000000000001",
  groupB: "20000000-0000-4000-8000-000000000002",
  admin: "00000000-0000-4000-8000-000000000001",
  operator: "00000000-0000-4000-8000-000000000002",
  viewer: "00000000-0000-4000-8000-000000000003",
  inactive: "00000000-0000-4000-8000-000000000004",
} as const;

interface MemorySession extends CreateSessionInput {
  id: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export class InMemoryAppRepository implements AppRepository, AuthRepository {
  readonly lines: LineRecord[];
  readonly groups: GroupRecord[];
  readonly automations: AutomationRecord[] = [];
  readonly events: EventLogRecord[] = [];
  readonly users: UserRecord[];
  readonly sessions: MemorySession[] = [];

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
    this.users = [
      { id: FIXTURE_IDS.admin, email: "admin@example.com", name: "Admin", passwordHash: "admin-hash", active: true, createdAt: now, updatedAt: now },
      { id: FIXTURE_IDS.operator, email: "operator@example.com", name: "Operator", passwordHash: "operator-hash", active: true, createdAt: now, updatedAt: now },
      { id: FIXTURE_IDS.viewer, email: "viewer@example.com", name: "Viewer", passwordHash: "viewer-hash", active: true, createdAt: now, updatedAt: now },
      { id: FIXTURE_IDS.inactive, email: "inactive@example.com", name: "Inactive", passwordHash: "inactive-hash", active: false, createdAt: now, updatedAt: now },
    ];
  }

  async listLines(): Promise<LineRecord[]> { return this.lines; }
  async getLine(id: string): Promise<LineRecord | null> { return this.lines.find((line) => line.id === id) ?? null; }
  async createLine(input: LineWrite): Promise<LineRecord> {
    const now = new Date();
    const line = { id: randomUUID(), name: input.name, slug: input.slug, active: input.active ?? true, createdAt: now, updatedAt: now };
    this.lines.push(line);
    return line;
  }
  async updateLine(id: string, input: LineWrite): Promise<LineRecord> {
    const line = this.lines.find((item) => item.id === id);
    if (!line) throw new Error("not found");
    line.name = input.name;
    line.slug = input.slug;
    line.active = input.active ?? line.active;
    line.updatedAt = new Date();
    return line;
  }
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
    this.recordEvent(automation, input.event, input.eventDescription, input.eventMetadata, input.createdBy ?? null);
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
    this.recordEvent(updated, input.event, input.eventDescription, input.eventMetadata, input.createdBy ?? null);
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
    this.recordEvent(automation, input.event, input.description, input.metadata, input.actorId);
    return automation;
  }

  async simulateTrigger(automationId: string, triggerId: string, status: "SENT" | "FAILED", actorId: string): Promise<AutomationRecord> {
    const automation = await this.getAutomation(automationId);
    const trigger = automation?.triggers.find((item) => item.id === triggerId && item.status === "PENDING");
    if (!automation || !trigger) throw new Error("not found");
    trigger.status = status;
    trigger.updatedAt = new Date();
    this.recordEvent(automation, status === "SENT" ? "TRIGGER_SIMULATED_SENT" : "TRIGGER_SIMULATED_FAILED", "Simulación", { triggerId }, actorId);
    return automation;
  }

  async listEvents(lineId: string): Promise<EventLogRecord[]> { return this.events.filter((event) => event.lineId === lineId); }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async createSession(input: CreateSessionInput): Promise<void> {
    this.sessions.push({ ...input, id: randomUUID(), lastUsedAt: null, revokedAt: null });
  }

  async getSessionPrincipal(tokenHash: string, now: Date): Promise<SessionPrincipal | null> {
    const session = this.sessions.find((item) => item.tokenHash === tokenHash && !item.revokedAt && item.expiresAt > now);
    const user = session ? this.users.find((item) => item.id === session.userId && item.active) : undefined;
    if (!session || !user) return null;
    const lineAccess = user.id === FIXTURE_IDS.admin
      ? [{ lineId: FIXTURE_IDS.lineA, role: "ADMIN" as const }, { lineId: FIXTURE_IDS.lineB, role: "ADMIN" as const }]
      : user.id === FIXTURE_IDS.operator
        ? [{ lineId: FIXTURE_IDS.lineA, role: "OPERATOR" as const }]
        : [{ lineId: FIXTURE_IDS.lineA, role: "VIEWER" as const }];
    return { sessionId: session.id, expiresAt: session.expiresAt, user: { id: user.id, email: user.email, name: user.name, lineAccess } };
  }

  async touchSession(sessionId: string, now: Date): Promise<void> {
    const session = this.sessions.find((item) => item.id === sessionId);
    if (session) session.lastUsedAt = now;
  }

  async revokeSession(tokenHash: string, now: Date): Promise<void> {
    const session = this.sessions.find((item) => item.tokenHash === tokenHash);
    if (session) session.revokedAt = now;
  }

  private recordEvent(automation: AutomationRecord, event: string, description: string, metadata?: Record<string, unknown> | null, actorId?: string | null): void {
    this.events.push({
      id: randomUUID(),
      lineId: automation.lineId,
      automationId: automation.id,
      userId: actorId ?? automation.createdBy,
      event,
      description,
      metadata: metadata ?? null,
      createdAt: new Date(),
    });
  }
}
