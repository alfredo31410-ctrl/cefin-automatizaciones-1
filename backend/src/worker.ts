import { readWorkerEnvironment } from "./config/env.js";
import { createDatabaseConnection } from "./db/client.js";
import { MockMessagingProvider } from "./messaging/mock-messaging-provider.js";
import { jsonWorkerLogger, safeErrorKind } from "./worker/logger.js";
import { PollingWorker } from "./worker/polling-worker.js";
import { PostgresWorkerRepository } from "./worker/postgres-worker-repository.js";
import { TriggerProcessor } from "./worker/trigger-processor.js";

async function main(): Promise<void> {
  const environment = readWorkerEnvironment();
  const connection = createDatabaseConnection(environment.DATABASE_URL);
  const repository = new PostgresWorkerRepository(connection.db);
  const processor = new TriggerProcessor(repository, new MockMessagingProvider(), jsonWorkerLogger);
  const worker = new PollingWorker(processor, {
    pollIntervalMs: environment.WORKER_POLL_INTERVAL_MS,
    batchSize: environment.WORKER_BATCH_SIZE,
  }, jsonWorkerLogger);

  const shutdown = (signal: NodeJS.Signals): void => {
    jsonWorkerLogger.info("signal_received", { signal });
    worker.stop();
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await worker.run();
  } finally {
    await connection.close();
    jsonWorkerLogger.info("database_pool_closed");
  }
}

main().catch((error: unknown) => {
  jsonWorkerLogger.error("worker_start_failed", { errorKind: safeErrorKind(error) });
  process.exitCode = 1;
});
