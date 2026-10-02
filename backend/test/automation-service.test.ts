import { describe, expect, it } from "vitest";
import { AutomationService } from "../src/services/automation-service.js";
import { FIXTURE_IDS, InMemoryAppRepository } from "./support/in-memory-repository.js";

function validPayload() {
  return {
    lineId: FIXTURE_IDS.lineA,
    name: "Campaña de prueba",
    type: "PREVENTA" as const,
    groupIds: [FIXTURE_IDS.groupA],
    triggers: [{ content: "Mensaje de prueba", scheduledAt: new Date("2027-01-01T15:00:00.000Z") }],
  };
}

describe("AutomationService", () => {
  it("crea una automatización válida", async () => {
    const repository = new InMemoryAppRepository();
    const created = await new AutomationService(repository).create(validPayload());

    expect(created.status).toBe("DRAFT");
    expect(created.lineId).toBe(FIXTURE_IDS.lineA);
    expect(created.groupIds).toEqual([FIXTURE_IDS.groupA]);
    expect(repository.events[0]?.event).toBe("AUTOMATION_CREATED");
  });

  it("rechaza un grupo perteneciente a otra línea", async () => {
    const service = new AutomationService(new InMemoryAppRepository());
    const action = service.create({ ...validPayload(), groupIds: [FIXTURE_IDS.groupB] });

    await expect(action).rejects.toMatchObject({ statusCode: 400, code: "CROSS_LINE_GROUP" });
  });

  it("duplica como borrador con triggers pendientes", async () => {
    const repository = new InMemoryAppRepository();
    const service = new AutomationService(repository);
    const original = await service.create({ ...validPayload(), activate: true });
    const duplicated = await service.duplicate(original.id);

    expect(duplicated.id).not.toBe(original.id);
    expect(duplicated.name).toBe("Campaña de prueba (copia)");
    expect(duplicated.status).toBe("DRAFT");
    expect(duplicated.triggers[0]?.status).toBe("PENDING");
  });

  it("pausa y reanuda conservando el estado anterior", async () => {
    const repository = new InMemoryAppRepository();
    const service = new AutomationService(repository);
    const created = await service.create({ ...validPayload(), activate: true });

    const paused = await service.pause(created.id);
    expect(paused.status).toBe("PAUSED");
    expect(paused.resumeStatus).toBe("SCHEDULED");

    const resumed = await service.resume(created.id);
    expect(resumed.status).toBe("SCHEDULED");
    expect(resumed.resumeStatus).toBeNull();
  });
});
