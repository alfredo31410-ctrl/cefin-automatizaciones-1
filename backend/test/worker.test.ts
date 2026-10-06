import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { readWorkerEnvironment } from "../src/config/env.js";
import { MockMessagingProvider } from "../src/messaging/mock-messaging-provider.js";
import type { AutomationStatus, GroupRecord, TriggerStatus } from "../src/domain/types.js";
import type { WorkerLogger } from "../src/worker/logger.js";
import { PollingWorker } from "../src/worker/polling-worker.js";
import { TriggerProcessor } from "../src/worker/trigger-processor.js";
import type { ClaimedTrigger, DeliveryContext, WorkerRepository } from "../src/worker/types.js";

const silentLogger: WorkerLogger = { info: vi.fn(), error: vi.fn() };
const NOW = new Date("2026-10-06T16:00:00.000Z");

interface MemoryJob {
  context: DeliveryContext;
}

class InMemoryWorkerRepository implements WorkerRepository {
  readonly events: Array<{ event: string; triggerId: string; failureCode?: string }> = [];

  constructor(readonly jobs: MemoryJob[]) {}

  async claimDueTriggers(limit: number, now: Date): Promise<ClaimedTrigger[]> {
    const claimed: ClaimedTrigger[] = [];
    for (const job of this.jobs) {
      if (claimed.length >= limit) break;
      const { trigger, automation } = job.context;
      if (trigger.status !== "PENDING" || trigger.scheduledAt > now) continue;
      if (automation.status !== "ACTIVE" && automation.status !== "SCHEDULED") continue;
      trigger.status = "PROCESSING";
      claimed.push({ id: trigger.id, automationId: trigger.automationId, scheduledAt: trigger.scheduledAt });
      this.events.push({ event: "TRIGGER_CLAIMED", triggerId: trigger.id });
    }
    return claimed;
  }

  async getDeliveryContext(triggerId: string): Promise<DeliveryContext | null> {
    return this.jobs.find(({ context }) => context.trigger.id === triggerId)?.context ?? null;
  }

  async markTriggerSent(triggerId: string): Promise<boolean> {
    const trigger = this.jobs.find(({ context }) => context.trigger.id === triggerId)?.context.trigger;
    if (!trigger || trigger.status !== "PROCESSING") return false;
    trigger.status = "SENT";
    this.events.push({ event: "TRIGGER_SENT", triggerId });
    return true;
  }

  async markTriggerFailed(triggerId: string, _completedAt: Date, failureCode: string): Promise<boolean> {
    const trigger = this.jobs.find(({ context }) => context.trigger.id === triggerId)?.context.trigger;
    if (!trigger || trigger.status !== "PROCESSING") return false;
    trigger.status = "FAILED";
    this.events.push({ event: "TRIGGER_FAILED", triggerId, failureCode });
    return true;
  }
}

function group(lineId = "line-a", active = true): GroupRecord {
  return {
    id: randomUUID(),
    lineId,
    name: "Grupo de prueba",
    externalId: null,
    memberCount: 10,
    active,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function job(options: {
  triggerStatus?: TriggerStatus;
  automationStatus?: AutomationStatus;
  scheduledAt?: Date;
  lineId?: string;
  groups?: GroupRecord[];
} = {}): MemoryJob {
  const automationId = randomUUID();
  const lineId = options.lineId ?? "line-a";
  return {
    context: {
      trigger: {
        id: randomUUID(),
        automationId,
        content: "Contenido de prueba",
        scheduledAt: options.scheduledAt ?? NOW,
        status: options.triggerStatus ?? "PENDING",
        attachmentMetadata: { name: "guia.pdf", type: "application/pdf" },
      },
      automation: {
        id: automationId,
        lineId,
        status: options.automationStatus ?? "ACTIVE",
      },
      groups: options.groups ?? [group(lineId)],
    },
  };
}

function processor(repository: WorkerRepository, provider = new MockMessagingProvider()): TriggerProcessor {
  return new TriggerProcessor(repository, provider, silentLogger, () => new Date(NOW));
}

describe("Worker V2.2", () => {
  it("no reclama trabajo cuando no hay triggers", async () => {
    const repository = new InMemoryWorkerRepository([]);
    await expect(processor(repository).runOnce(10)).resolves.toEqual({ claimed: 0, sent: 0, failed: 0 });
  });

  it("procesa un trigger vencido y registra eventos de claim y éxito", async () => {
    const due = job();
    const repository = new InMemoryWorkerRepository([due]);
    const provider = new MockMessagingProvider();

    await expect(processor(repository, provider).runOnce(10)).resolves.toEqual({ claimed: 1, sent: 1, failed: 0 });

    expect(due.context.trigger.status).toBe("SENT");
    expect(repository.events.map(({ event }) => event)).toEqual(["TRIGGER_CLAIMED", "TRIGGER_SENT"]);
    expect(provider.deliveries).toEqual([expect.objectContaining({
      triggerId: due.context.trigger.id,
      automationId: due.context.automation.id,
      lineId: due.context.automation.lineId,
      attachmentMetadata: due.context.trigger.attachmentMetadata,
    })]);
  });

  it("no reclama un trigger futuro", async () => {
    const future = job({ scheduledAt: new Date(NOW.getTime() + 1) });
    const repository = new InMemoryWorkerRepository([future]);
    await expect(processor(repository).runOnce(10)).resolves.toEqual({ claimed: 0, sent: 0, failed: 0 });
    expect(future.context.trigger.status).toBe("PENDING");
  });

  it.each(["CANCELLED", "SENT", "FAILED"] as const)("no reclama triggers %s", async (status) => {
    const terminal = job({ triggerStatus: status });
    const repository = new InMemoryWorkerRepository([terminal]);
    expect((await processor(repository).runOnce(10)).claimed).toBe(0);
    expect(terminal.context.trigger.status).toBe(status);
  });

  it.each(["DRAFT", "PAUSED", "CANCELLED", "COMPLETED", "ERROR"] as const)(
    "no reclama triggers de una automatización %s",
    async (status) => {
      const blocked = job({ automationStatus: status });
      const repository = new InMemoryWorkerRepository([blocked]);
      expect((await processor(repository).runOnce(10)).claimed).toBe(0);
      expect(blocked.context.trigger.status).toBe("PENDING");
    },
  );

  it.each(["ACTIVE", "SCHEDULED"] as const)("procesa automatizaciones %s", async (status) => {
    const valid = job({ automationStatus: status });
    const repository = new InMemoryWorkerRepository([valid]);
    expect(await processor(repository).runOnce(10)).toEqual({ claimed: 1, sent: 1, failed: 0 });
  });

  it("revalida la automatización después del claim y no entrega si fue pausada", async () => {
    const due = job();
    class PausingRepository extends InMemoryWorkerRepository {
      override async claimDueTriggers(limit: number, now: Date): Promise<ClaimedTrigger[]> {
        const claimed = await super.claimDueTriggers(limit, now);
        due.context.automation.status = "PAUSED";
        return claimed;
      }
    }
    const repository = new PausingRepository([due]);
    const provider = new MockMessagingProvider();

    expect(await processor(repository, provider).runOnce(10)).toEqual({ claimed: 1, sent: 0, failed: 1 });
    expect(provider.deliveries).toHaveLength(0);
    expect(repository.events.at(-1)).toEqual(expect.objectContaining({
      event: "TRIGGER_FAILED",
      failureCode: "AUTOMATION_NOT_PROCESSABLE",
    }));
  });

  it("rechaza grupos cruzados y continúa con el siguiente trabajo", async () => {
    const crossed = job({ groups: [group("line-b")] });
    const valid = job();
    const repository = new InMemoryWorkerRepository([crossed, valid]);
    const provider = new MockMessagingProvider();

    expect(await processor(repository, provider).runOnce(10)).toEqual({ claimed: 2, sent: 1, failed: 1 });
    expect(crossed.context.trigger.status).toBe("FAILED");
    expect(valid.context.trigger.status).toBe("SENT");
    expect(repository.events).toContainEqual(expect.objectContaining({
      event: "TRIGGER_FAILED",
      triggerId: crossed.context.trigger.id,
      failureCode: "CROSS_LINE_GROUP",
    }));
  });

  it.each([
    ["sin grupos", []],
    ["con grupo inactivo", [group("line-a", false)]],
  ] as const)("falla de forma controlada %s", async (_case, groups) => {
    const invalid = job({ groups: [...groups] });
    const repository = new InMemoryWorkerRepository([invalid]);
    expect(await processor(repository).runOnce(10)).toEqual({ claimed: 1, sent: 0, failed: 1 });
    expect(invalid.context.trigger.status).toBe("FAILED");
  });

  it("provider failure cambia a FAILED y crea EventLog", async () => {
    const due = job();
    const repository = new InMemoryWorkerRepository([due]);
    expect(await processor(repository, new MockMessagingProvider("failure")).runOnce(10))
      .toEqual({ claimed: 1, sent: 0, failed: 1 });
    expect(due.context.trigger.status).toBe("FAILED");
    expect(repository.events.at(-1)).toEqual(expect.objectContaining({
      event: "TRIGGER_FAILED",
      failureCode: "DELIVERY_FAILED",
    }));
  });

  it("solo un worker puede reclamar el mismo trigger", async () => {
    const due = job();
    const repository = new InMemoryWorkerRepository([due]);
    const [first, second] = await Promise.all([
      repository.claimDueTriggers(1, NOW),
      repository.claimDueTriggers(1, NOW),
    ]);
    expect([...first, ...second]).toHaveLength(1);
    expect(due.context.trigger.status).toBe("PROCESSING");
  });

  it("compara el instante de Ciudad de México como UTC absoluto", async () => {
    const mexicoTenAm = new Date("2026-10-06T10:00:00-06:00");
    expect(mexicoTenAm.toISOString()).toBe("2026-10-06T16:00:00.000Z");
    const due = job({ scheduledAt: mexicoTenAm });
    const repository = new InMemoryWorkerRepository([due]);
    expect(await repository.claimDueTriggers(1, new Date("2026-10-06T15:59:59.999Z"))).toHaveLength(0);
    expect(await repository.claimDueTriggers(1, new Date("2026-10-06T16:00:00.000Z"))).toHaveLength(1);
  });

  it("valida configuración segura y valores por defecto", () => {
    expect(readWorkerEnvironment({ DATABASE_URL: "postgres://test", NODE_ENV: "test" })).toEqual({
      DATABASE_URL: "postgres://test",
      NODE_ENV: "test",
      WORKER_POLL_INTERVAL_MS: 5_000,
      WORKER_BATCH_SIZE: 10,
    });
    expect(() => readWorkerEnvironment({ DATABASE_URL: "postgres://test", WORKER_POLL_INTERVAL_MS: "10" }))
      .toThrow("Configuración inválida");
  });

  it("shutdown despierta el polling y espera la operación actual", async () => {
    let release: () => void = () => undefined;
    const active = new Promise<void>((resolve) => { release = resolve; });
    const pollProcessor = {
      runOnce: vi.fn(async () => {
        await active;
        return { claimed: 0, sent: 0, failed: 0 };
      }),
    };
    const worker = new PollingWorker(pollProcessor, { pollIntervalMs: 60_000, batchSize: 1 }, silentLogger);
    const running = worker.run();
    await vi.waitFor(() => expect(pollProcessor.runOnce).toHaveBeenCalledOnce());
    worker.stop();
    let stopped = false;
    void running.then(() => { stopped = true; });
    await Promise.resolve();
    expect(stopped).toBe(false);
    release();
    await running;
    expect(stopped).toBe(true);
  });
});
