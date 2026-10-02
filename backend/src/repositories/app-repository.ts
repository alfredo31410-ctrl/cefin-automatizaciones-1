import type {
  AutomationRecord,
  AutomationStatus,
  AutomationWrite,
  EventLogRecord,
  GroupRecord,
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
}

export interface AppRepository {
  listLines(): Promise<LineRecord[]>;
  getLine(id: string): Promise<LineRecord | null>;
  listGroups(lineId: string): Promise<GroupRecord[]>;
  getGroupsByIds(ids: string[]): Promise<GroupRecord[]>;
  listAutomations(lineId: string): Promise<AutomationRecord[]>;
  getAutomation(id: string): Promise<AutomationRecord | null>;
  createAutomation(input: AutomationWrite): Promise<AutomationRecord>;
  updateAutomation(id: string, input: AutomationWrite): Promise<AutomationRecord>;
  transitionAutomation(id: string, input: StatusTransition): Promise<AutomationRecord>;
  listEvents(lineId: string): Promise<EventLogRecord[]>;
}
