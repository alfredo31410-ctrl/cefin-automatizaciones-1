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

export type EventType =
  | "AUTOMATION_CREATED"
  | "AUTOMATION_UPDATED"
  | "AUTOMATION_ACTIVATED"
  | "AUTOMATION_PAUSED"
  | "AUTOMATION_RESUMED"
  | "AUTOMATION_DUPLICATED"
  | "AUTOMATION_CANCELLED"
  | "TRIGGER_SIMULATED_SENT"
  | "TRIGGER_SIMULATED_FAILED";

export interface Group {
  id: string;
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
  automationId: string;
  content: string;
  scheduledAt: string;
  status: TriggerStatus;
  attachment?: Attachment;
  createdAt: string;
  updatedAt: string;
}

export interface Automation {
  id: string;
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
  automationId: string;
  automationName: string;
  type: EventType;
  description: string;
  createdAt: string;
}

export interface AppDatabase {
  groups: Group[];
  automations: Automation[];
  eventLogs: EventLog[];
  version: number;
}

export interface AutomationInput {
  name: string;
  type: AutomationType;
  groupIds: string[];
  triggers: Array<Pick<Trigger, "id" | "content" | "scheduledAt" | "attachment">>;
}
