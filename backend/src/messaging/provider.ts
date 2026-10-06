import type { GroupRecord } from "../domain/types.js";

export interface SendMessageInput {
  lineId: string;
  automationId: string;
  triggerId: string;
  groups: GroupRecord[];
  content: string;
  attachmentMetadata: Record<string, unknown> | null;
}

export interface SendMessageResult {
  providerMessageId: string;
}

export interface MessagingProvider {
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
}
