import type { MessagingProvider, SendMessageInput, SendMessageResult } from "./provider.js";

export type MockMessagingBehavior = "success" | "failure";

/** Simulates delivery in memory. It never performs network or browser I/O. */
export class MockMessagingProvider implements MessagingProvider {
  readonly deliveries: SendMessageInput[] = [];

  constructor(private readonly behavior: MockMessagingBehavior = "success") {}

  sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    if (this.behavior === "failure") return Promise.reject(new Error("MOCK_DELIVERY_FAILED"));
    this.deliveries.push(input);
    return Promise.resolve({ providerMessageId: `mock-${input.triggerId}` });
  }
}
