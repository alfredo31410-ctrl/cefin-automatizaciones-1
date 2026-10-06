import { safeErrorKind, type WorkerLogger } from "./logger.js";
import type { ProcessingSummary } from "./trigger-processor.js";

export interface PollingWorkerOptions {
  pollIntervalMs: number;
  batchSize: number;
}

interface PollProcessor {
  runOnce(batchSize: number): Promise<ProcessingSummary>;
}

export class PollingWorker {
  private stopRequested = false;
  private wake: (() => void) | undefined;

  constructor(
    private readonly processor: PollProcessor,
    private readonly options: PollingWorkerOptions,
    private readonly logger: WorkerLogger,
  ) {}

  async run(): Promise<void> {
    this.logger.info("worker_started", { ...this.options });
    while (!this.stopRequested) {
      try {
        const summary = await this.processor.runOnce(this.options.batchSize);
        if (summary.claimed > 0) this.logger.info("poll_completed", { ...summary });
      } catch (error) {
        this.logger.error("poll_failed", { errorKind: safeErrorKind(error) });
      }
      if (!this.stopRequested) await this.waitForNextPoll();
    }
    this.logger.info("worker_stopped");
  }

  stop(): void {
    if (this.stopRequested) return;
    this.stopRequested = true;
    this.logger.info("shutdown_requested");
    this.wake?.();
  }

  private async waitForNextPoll(): Promise<void> {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.wake = undefined;
        resolve();
      }, this.options.pollIntervalMs);
      this.wake = () => {
        clearTimeout(timer);
        this.wake = undefined;
        resolve();
      };
    });
  }
}
