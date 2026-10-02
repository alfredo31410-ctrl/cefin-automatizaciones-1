import type { Attachment, Group } from "@/lib/domain/types";

export interface ScheduleMessageInput {
  lineId: string;
  groupIds: string[];
  content: string;
  scheduledAt: string;
  attachment?: Attachment;
}

export interface MessagingProvider {
  listGroups(lineId: string): Promise<Group[]>;
  scheduleMessage(input: ScheduleMessageInput): Promise<{ externalScheduleId: string }>;
  cancelScheduledMessage(externalScheduleId: string): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; mode: "mock" | "live" }>;
}
