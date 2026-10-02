import { appRepository } from "@/lib/repositories/json-app-repository";
import type { MessagingProvider, ScheduleMessageInput } from "./provider";

/**
 * Proveedor exclusivo del MVP local. Nunca se conecta a Funnelchat o WhatsApp y
 * nunca transmite mensajes. Conserva el contrato que deberá implementar un
 * futuro FunnelchatMessagingProvider cuando exista una API verificada.
 */
export class MockMessagingProvider implements MessagingProvider {
  async listGroups() {
    return (await appRepository.getDatabase()).groups;
  }

  async scheduleMessage(input: ScheduleMessageInput) {
    void input;
    return { externalScheduleId: `mock-${crypto.randomUUID()}` };
  }

  async cancelScheduledMessage(externalScheduleId: string) {
    void externalScheduleId;
    return Promise.resolve();
  }

  async healthCheck() {
    return { healthy: true, mode: "mock" as const };
  }
}

export const messagingProvider: MessagingProvider = new MockMessagingProvider();
