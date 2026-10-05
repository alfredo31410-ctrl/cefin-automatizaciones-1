export type AutomationType = "PREVENTA" | "VENTA" | "RETARGETING" | "CALENTAMIENTO";

export type AutomationStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "ERROR"
  | "CANCELLED";

export type TriggerStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED";

export type EventType = string;

export interface Line {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  lineId: string;
  name: string;
  externalId?: string;
  memberCount?: number;
  active: boolean;
  createdAt: string;
}

export interface Attachment {
  name: string;
  type?: string;
  size?: number;
}

export interface Trigger {
  id: string;
  automationId?: string;
  content: string;
  scheduledAt: string;
  status: TriggerStatus;
  attachment?: Attachment;
  createdAt: string;
  updatedAt: string;
}

export interface Automation {
  id: string;
  lineId: string;
  name: string;
  type: AutomationType;
  status: AutomationStatus;
  groupIds: string[];
  triggers: Trigger[];
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  finishedAt?: string;
  resumeStatus?: "ACTIVE" | "SCHEDULED";
}

export interface EventLog {
  id: string;
  lineId: string;
  automationId?: string;
  automationName: string;
  type: EventType;
  description: string;
  createdAt: string;
}

export interface AppDatabase {
  lines: Line[];
  groups: Group[];
  automations: Automation[];
  eventLogs: EventLog[];
  version: number;
  schemaVersion: 2;
}

export interface AutomationInput {
  name: string;
  type: AutomationType;
  groupIds: string[];
  triggers: Array<Pick<Trigger, "id" | "content" | "scheduledAt" | "attachment">>;
}
