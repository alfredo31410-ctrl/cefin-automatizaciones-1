import type { Attachment, Group } from "@/lib/domain/types";

export interface ScheduleMessageInput {
  groupIds: string[];
  content: string;
  scheduledAt: string;
  attachment?: Attachment;
}

export interface MessagingProvider {
  listGroups(): Promise<Group[]>;
  scheduleMessage(input: ScheduleMessageInput): Promise<{ externalScheduleId: string }>;
  cancelScheduledMessage(externalScheduleId: string): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; mode: "mock" | "live" }>;
}
