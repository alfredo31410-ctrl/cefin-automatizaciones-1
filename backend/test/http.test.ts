import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { PasswordHasher } from "../src/auth/password.js";
import { FIXTURE_IDS, InMemoryAppRepository } from "./support/in-memory-repository.js";

let app: FastifyInstance | undefined;
const passwordHasher: PasswordHasher = {
  hash: async (password) => `${password}-hash`,
  verify: async (passwordHash, password) => passwordHash === `${password}-hash`,
};

async function loginCookie(instance: FastifyInstance, email = "admin@example.com", password = "admin"): Promise<string> {
  const response = await instance.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email, password } });
  expect(response.statusCode).toBe(200);
  const cookie = String(response.headers["set-cookie"]).split(";")[0];
  if (!cookie) throw new Error("La respuesta no incluyó una cookie de sesión");
  return cookie;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("HTTP API", () => {
  it("reporta API y base conectadas", async () => {
    app = await buildApp({ repository: new InMemoryAppRepository(), healthCheck: async () => undefined, allowedOrigins: ["http://localhost:3000"], passwordHasher });
    const response = await app.inject({ method: "GET", url: "/health" });
    const prefixedResponse = await app.inject({ method: "GET", url: "/api/v1/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", database: "connected" });
    expect(prefixedResponse.statusCode).toBe(404);
    expect(prefixedResponse.json()).toEqual({ error: { code: "ROUTE_NOT_FOUND", message: "Ruta no encontrada" } });
  });

  it("responde 503 sin filtrar detalles cuando falla la base", async () => {
    app = await buildApp({ repository: new InMemoryAppRepository(), healthCheck: async () => { throw new Error("postgres://secret"); }, allowedOrigins: [], passwordHasher });
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("secret");
    expect(response.json()).toEqual({ status: "error", database: "disconnected" });
  });

  it("mantiene disponible el listado versionado de líneas", async () => {
    app = await buildApp({ repository: new InMemoryAppRepository(), healthCheck: async () => undefined, allowedOrigins: [], passwordHasher });
    const cookie = await loginCookie(app);
    const response = await app.inject({ method: "GET", url: "/api/v1/lines", headers: { cookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ data: Array<{ id: string; name: string }> }>().data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: FIXTURE_IDS.lineA, name: "CEFIN" }),
      expect.objectContaining({ id: FIXTURE_IDS.lineB, name: "EBIA" }),
    ]));
  });

  it("preserva el 400 seguro de Fastify para JSON vacío", async () => {
    app = await buildApp({ repository: new InMemoryAppRepository(), healthCheck: async () => undefined, allowedOrigins: [], passwordHasher });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { "content-type": "application/json" },
      payload: "",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: { code: "BAD_REQUEST", message: "La solicitud no es válida" },
    });
    expect(response.body).not.toContain("FST_ERR_CTP_EMPTY_JSON_BODY");
    expect(response.body).not.toContain("Body cannot be empty");
  });

  it("crea y recupera una automatización por HTTP", async () => {
    app = await buildApp({ repository: new InMemoryAppRepository(), healthCheck: async () => undefined, allowedOrigins: ["http://localhost:3000"], passwordHasher });
    const cookie = await loginCookie(app, "operator@example.com", "operator");
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/automations",
      headers: { origin: "http://localhost:3000", cookie },
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

    const detail = await app.inject({ method: "GET", url: `/api/v1/automations/${automationId}`, headers: { cookie } });
    expect(detail.statusCode).toBe(200);
    expect(detail.json<{ data: { name: string } }>().data.name).toBe("Flujo HTTP");
  });

  it("normaliza America/Mexico_City a un instante UTC antes de persistir", async () => {
    app = await buildApp({ repository: new InMemoryAppRepository(), healthCheck: async () => undefined, allowedOrigins: [], passwordHasher });
    const cookie = await loginCookie(app, "operator@example.com", "operator");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/automations",
      headers: { cookie },
      payload: {
        lineId: FIXTURE_IDS.lineA,
        name: "Timezone México",
        type: "VENTA",
        groupIds: [FIXTURE_IDS.groupA],
        triggers: [{ content: "Mensaje", scheduledAt: "2026-10-06T10:00:00-06:00" }],
        activate: true,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json<{ data: { triggers: Array<{ scheduledAt: string }> } }>().data.triggers[0]?.scheduledAt)
      .toBe("2026-10-06T16:00:00.000Z");
  });

  it("cubre el flujo API usado por dashboard, cambio de línea y ciclo de automatización", async () => {
    app = await buildApp({ repository: new InMemoryAppRepository(), healthCheck: async () => undefined, allowedOrigins: [], passwordHasher });
    const cookie = await loginCookie(app);
    const headers = { cookie };

    const lines = await app.inject({ method: "GET", url: "/api/v1/lines", headers });
    const groupsA = await app.inject({ method: "GET", url: `/api/v1/lines/${FIXTURE_IDS.lineA}/groups`, headers });
    const groupsB = await app.inject({ method: "GET", url: `/api/v1/lines/${FIXTURE_IDS.lineB}/groups`, headers });
    expect(lines.json<{ data: unknown[] }>().data).toHaveLength(2);
    expect(groupsA.json<{ data: unknown[] }>().data).toHaveLength(1);
    expect(groupsB.json<{ data: unknown[] }>().data).toHaveLength(1);

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/automations",
      headers,
      payload: {
        lineId: FIXTURE_IDS.lineA,
        name: "Ciclo completo",
        type: "VENTA",
        groupIds: [FIXTURE_IDS.groupA],
        triggers: [{ content: "Mensaje persistido", scheduledAt: "2099-01-01T15:00:00.000Z", attachmentMetadata: { name: "guia.pdf" } }],
        activate: true,
      },
    });
    expect(created.statusCode).toBe(201);
    const automationId = created.json<{ data: { id: string; status: string } }>().data.id;
    expect(created.json<{ data: { status: string } }>().data.status).toBe("SCHEDULED");

    const updated = await app.inject({ method: "PATCH", url: `/api/v1/automations/${automationId}`, headers, payload: { name: "Ciclo actualizado" } });
    const duplicated = await app.inject({ method: "POST", url: `/api/v1/automations/${automationId}/duplicate`, headers });
    const paused = await app.inject({ method: "POST", url: `/api/v1/automations/${automationId}/pause`, headers });
    const resumed = await app.inject({ method: "POST", url: `/api/v1/automations/${automationId}/resume`, headers });
    const cancelled = await app.inject({ method: "POST", url: `/api/v1/automations/${automationId}/cancel`, headers });

    expect(updated.json<{ data: { name: string } }>().data.name).toBe("Ciclo actualizado");
    expect(duplicated.statusCode).toBe(201);
    expect(paused.statusCode).toBe(200);
    expect(resumed.statusCode).toBe(200);
    expect(cancelled.statusCode).toBe(200);
    expect(duplicated.json<{ data: { status: string } }>().data.status).toBe("DRAFT");
    expect(paused.json<{ data: { status: string } }>().data.status).toBe("PAUSED");
    expect(resumed.json<{ data: { status: string } }>().data.status).toBe("SCHEDULED");
    expect(cancelled.json<{ data: { status: string } }>().data.status).toBe("CANCELLED");

    const automations = await app.inject({ method: "GET", url: `/api/v1/lines/${FIXTURE_IDS.lineA}/automations`, headers });
    const events = await app.inject({ method: "GET", url: `/api/v1/lines/${FIXTURE_IDS.lineA}/events`, headers });
    expect(automations.json<{ data: unknown[] }>().data).toHaveLength(2);
    expect(events.json<{ data: Array<{ event: string; userId: string | null }> }>().data).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: "AUTOMATION_CREATED", userId: FIXTURE_IDS.admin }),
      expect.objectContaining({ event: "AUTOMATION_UPDATED", userId: FIXTURE_IDS.admin }),
      expect.objectContaining({ event: "AUTOMATION_DUPLICATED", userId: FIXTURE_IDS.admin }),
      expect.objectContaining({ event: "AUTOMATION_PAUSED", userId: FIXTURE_IDS.admin }),
      expect.objectContaining({ event: "AUTOMATION_RESUMED", userId: FIXTURE_IDS.admin }),
      expect.objectContaining({ event: "AUTOMATION_CANCELLED", userId: FIXTURE_IDS.admin }),
    ]));
  });

  it.each([
    ["enum inválido", { lineId: FIXTURE_IDS.lineA, name: "Prueba", type: "OTRO", groupIds: [FIXTURE_IDS.groupA], triggers: [{ content: "Mensaje", scheduledAt: "2027-01-01T15:00:00.000Z" }] }],
    ["fecha sin zona horaria", { lineId: FIXTURE_IDS.lineA, name: "Prueba", type: "VENTA", groupIds: [FIXTURE_IDS.groupA], triggers: [{ content: "Mensaje", scheduledAt: "2027-01-01T09:00:00" }] }],
  ])("rechaza %s", async (_case, body) => {
    app = await buildApp({ repository: new InMemoryAppRepository(), healthCheck: async () => undefined, allowedOrigins: [], passwordHasher });
    const cookie = await loginCookie(app, "operator@example.com", "operator");
    const response = await app.inject({ method: "POST", url: "/api/v1/automations", headers: { cookie }, payload: body });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: { code: "VALIDATION_ERROR", message: "La solicitud contiene datos inválidos" } });
  });
});
