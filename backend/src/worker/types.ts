import type { AutomationStatus, GroupRecord, TriggerStatus } from "../domain/types.js";

export interface ClaimedTrigger {
  id: string;
  automationId: string;
  scheduledAt: Date;
}

export interface DeliveryContext {
  trigger: {
    id: string;
    automationId: string;
    content: string;
    scheduledAt: Date;
    status: TriggerStatus;
    attachmentMetadata: Record<string, unknown> | null;
  };
  automation: {
    id: string;
    lineId: string;
    status: AutomationStatus;
  };
  groups: GroupRecord[];
}

export interface WorkerRepository {
  claimDueTriggers(limit: number, now: Date): Promise<ClaimedTrigger[]>;
  getDeliveryContext(triggerId: string): Promise<DeliveryContext | null>;
  markTriggerSent(triggerId: string, completedAt: Date): Promise<boolean>;
  markTriggerFailed(triggerId: string, completedAt: Date, failureCode: string): Promise<boolean>;
}
