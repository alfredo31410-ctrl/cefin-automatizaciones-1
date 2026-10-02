import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { FIXTURE_IDS, InMemoryAppRepository } from "./support/in-memory-repository.js";

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("HTTP API", () => {
  it("reporta API y base conectadas", async () => {
    app = await buildApp({ repository: new InMemoryAppRepository(), healthCheck: async () => undefined, allowedOrigins: ["http://localhost:3000"] });
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", database: "connected" });
  });

  it("responde 503 sin filtrar detalles cuando falla la base", async () => {
    app = await buildApp({ repository: new InMemoryAppRepository(), healthCheck: async () => { throw new Error("postgres://secret"); }, allowedOrigins: [] });
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("secret");
    expect(response.json()).toEqual({ status: "error", database: "disconnected" });
  });

  it("crea y recupera una automatización por HTTP", async () => {
    app = await buildApp({ repository: new InMemoryAppRepository(), healthCheck: async () => undefined, allowedOrigins: ["http://localhost:3000"] });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/automations",
      headers: { origin: "http://localhost:3000" },
      payload: {
        lineId: FIXTURE_IDS.lineA,
        name: "Flujo HTTP",
        type: "VENTA",
        groupIds: [FIXTURE_IDS.groupA],
        triggers: [{ content: "Mensaje", scheduledAt: "2027-01-01T15:00:00.000Z" }],
      },
    });

    expect(created.statusCode).toBe(201);
    expect(created.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    const automationId = created.json<{ data: { id: string } }>().data.id;

    const detail = await app.inject({ method: "GET", url: `/api/v1/automations/${automationId}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json<{ data: { name: string } }>().data.name).toBe("Flujo HTTP");
  });

  it.each([
    ["enum inválido", { lineId: FIXTURE_IDS.lineA, name: "Prueba", type: "OTRO", groupIds: [FIXTURE_IDS.groupA], triggers: [{ content: "Mensaje", scheduledAt: "2027-01-01T15:00:00.000Z" }] }],
    ["fecha sin zona horaria", { lineId: FIXTURE_IDS.lineA, name: "Prueba", type: "VENTA", groupIds: [FIXTURE_IDS.groupA], triggers: [{ content: "Mensaje", scheduledAt: "2027-01-01T09:00:00" }] }],
  ])("rechaza %s", async (_case, body) => {
    app = await buildApp({ repository: new InMemoryAppRepository(), healthCheck: async () => undefined, allowedOrigins: [] });
    const response = await app.inject({ method: "POST", url: "/api/v1/automations", payload: body });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: { code: "VALIDATION_ERROR", message: "La solicitud contiene datos inválidos" } });
  });
});
