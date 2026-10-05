export const AUTOMATION_TYPES = ["PREVENTA", "VENTA", "RETARGETING", "CALENTAMIENTO"] as const;
export type AutomationType = (typeof AUTOMATION_TYPES)[number];

export const AUTOMATION_STATUSES = ["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "ERROR", "CANCELLED"] as const;
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

export const TRIGGER_STATUSES = ["PENDING", "PROCESSING", "SENT", "FAILED", "CANCELLED"] as const;
export type TriggerStatus = (typeof TRIGGER_STATUSES)[number];

export const USER_LINE_ROLES = ["ADMIN", "OPERATOR", "VIEWER"] as const;
export type UserLineRole = (typeof USER_LINE_ROLES)[number];

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserLineAccess {
  lineId: string;
  role: UserLineRole;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  lineAccess: UserLineAccess[];
}

export interface SessionPrincipal {
  sessionId: string;
  expiresAt: Date;
  user: AuthenticatedUser;
}

export interface LineRecord {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupRecord {
  id: string;
  lineId: string;
  name: string;
  externalId: string | null;
  memberCount: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TriggerRecord {
  id: string;
  automationId: string;
  content: string;
  scheduledAt: Date;
  status: TriggerStatus;
  attachmentMetadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationRecord {
  id: string;
  lineId: string;
  name: string;
  type: AutomationType;
  status: AutomationStatus;
  createdBy: string | null;
  groupIds: string[];
  triggers: TriggerRecord[];
  createdAt: Date;
  updatedAt: Date;
  activatedAt: Date | null;
  finishedAt: Date | null;
  resumeStatus: "ACTIVE" | "SCHEDULED" | null;
}

export interface EventLogRecord {
  id: string;
  lineId: string;
  automationId: string | null;
  userId: string | null;
  event: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface LineWrite {
  name: string;
  slug: string;
  active?: boolean;
  actorId: string;
}

export interface TriggerInput {
  id?: string;
  content: string;
  scheduledAt: Date;
  status?: TriggerStatus;
  attachmentMetadata?: Record<string, unknown> | null;
}

export interface AutomationWrite {
  id?: string;
  lineId: string;
  name: string;
  type: AutomationType;
  status: AutomationStatus;
  createdBy?: string | null;
  groupIds: string[];
  triggers: TriggerInput[];
  activatedAt?: Date | null;
  finishedAt?: Date | null;
  resumeStatus?: "ACTIVE" | "SCHEDULED" | null;
  event: string;
  eventDescription: string;
  eventMetadata?: Record<string, unknown> | null;
}
