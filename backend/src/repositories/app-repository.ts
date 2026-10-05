import type {
  AutomationRecord,
  AutomationStatus,
  AutomationWrite,
  EventLogRecord,
  GroupRecord,
  LineWrite,
  LineRecord,
} from "../domain/types.js";

export interface StatusTransition {
  status: AutomationStatus;
  resumeStatus?: "ACTIVE" | "SCHEDULED" | null;
  activatedAt?: Date | null;
  finishedAt?: Date | null;
  cancelPendingTriggers?: boolean;
  event: string;
  description: string;
  metadata?: Record<string, unknown> | null;
  actorId: string;
}

export interface AppRepository {
  listLines(): Promise<LineRecord[]>;
  getLine(id: string): Promise<LineRecord | null>;
  createLine(input: LineWrite): Promise<LineRecord>;
  updateLine(id: string, input: LineWrite): Promise<LineRecord>;
  listGroups(lineId: string): Promise<GroupRecord[]>;
  getGroupsByIds(ids: string[]): Promise<GroupRecord[]>;
  listAutomations(lineId: string): Promise<AutomationRecord[]>;
  getAutomation(id: string): Promise<AutomationRecord | null>;
  createAutomation(input: AutomationWrite): Promise<AutomationRecord>;
  updateAutomation(id: string, input: AutomationWrite): Promise<AutomationRecord>;
  transitionAutomation(id: string, input: StatusTransition): Promise<AutomationRecord>;
  simulateTrigger(automationId: string, triggerId: string, status: "SENT" | "FAILED", actorId: string): Promise<AutomationRecord>;
  listEvents(lineId: string): Promise<EventLogRecord[]>;
}
