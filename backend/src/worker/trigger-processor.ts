import type { MessagingProvider } from "../messaging/provider.js";
import { safeErrorKind, type WorkerLogger } from "./logger.js";
import type { ClaimedTrigger, DeliveryContext, WorkerRepository } from "./types.js";

const PROCESSABLE_AUTOMATION_STATUSES = new Set(["ACTIVE", "SCHEDULED"]);

export interface ProcessingSummary {
  claimed: number;
  sent: number;
  failed: number;
}

class DeliveryValidationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "DeliveryValidationError";
  }
}

export class TriggerProcessor {
  constructor(
    private readonly repository: WorkerRepository,
    private readonly provider: MessagingProvider,
    private readonly logger: WorkerLogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async runOnce(batchSize: number): Promise<ProcessingSummary> {
    const claimed = await this.repository.claimDueTriggers(batchSize, this.now());
    const summary: ProcessingSummary = { claimed: claimed.length, sent: 0, failed: 0 };

    for (const trigger of claimed) {
      const result = await this.processTrigger(trigger);
      summary[result] += 1;
    }

    return summary;
  }

  private async processTrigger(claimed: ClaimedTrigger): Promise<"sent" | "failed"> {
    this.logger.info("trigger_claimed", { triggerId: claimed.id, automationId: claimed.automationId });
    try {
      const context = await this.repository.getDeliveryContext(claimed.id);
      if (!context) throw new DeliveryValidationError("DELIVERY_CONTEXT_MISSING");
      this.assertContext(context);

      await this.provider.sendMessage({
        lineId: context.automation.lineId,
        automationId: context.automation.id,
        triggerId: context.trigger.id,
        groups: context.groups,
        content: context.trigger.content,
        attachmentMetadata: context.trigger.attachmentMetadata,
      });

      const marked = await this.repository.markTriggerSent(claimed.id, this.now());
      if (!marked) throw new DeliveryValidationError("TRIGGER_NOT_PROCESSING");
      this.logger.info("trigger_sent", { triggerId: claimed.id, automationId: claimed.automationId });
      return "sent";
    } catch (error) {
      const failureCode = error instanceof DeliveryValidationError ? error.code : "DELIVERY_FAILED";
      try {
        await this.repository.markTriggerFailed(claimed.id, this.now(), failureCode);
      } catch (finalizationError) {
        this.logger.error("trigger_failure_persistence_failed", {
          triggerId: claimed.id,
          errorKind: safeErrorKind(finalizationError),
        });
      }
      this.logger.error("trigger_failed", {
        triggerId: claimed.id,
        automationId: claimed.automationId,
        failureCode,
        errorKind: safeErrorKind(error),
      });
      return "failed";
    }
  }

  private assertContext(context: DeliveryContext): void {
    if (context.trigger.status !== "PROCESSING") {
      throw new DeliveryValidationError("TRIGGER_NOT_PROCESSING");
    }
    if (!PROCESSABLE_AUTOMATION_STATUSES.has(context.automation.status)) {
      throw new DeliveryValidationError("AUTOMATION_NOT_PROCESSABLE");
    }
    if (context.groups.length === 0) {
      throw new DeliveryValidationError("NO_VALID_GROUPS");
    }
    if (context.groups.some((group) => group.lineId !== context.automation.lineId)) {
      throw new DeliveryValidationError("CROSS_LINE_GROUP");
    }
    if (context.groups.some((group) => !group.active)) {
      throw new DeliveryValidationError("INACTIVE_GROUP");
    }
  }
}
