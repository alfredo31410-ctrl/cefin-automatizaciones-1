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

async function setup() {
  const repository = new InMemoryAppRepository();
  app = await buildApp({ repository, healthCheck: async () => undefined, allowedOrigins: ["http://localhost:3000"], passwordHasher });
  return { app, repository };
}

async function login(instance: FastifyInstance, email: string, password: string) {
  return instance.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email, password } });
}

function cookieFrom(response: Awaited<ReturnType<typeof login>>): string {
  const cookie = String(response.headers["set-cookie"]).split(";")[0];
  if (!cookie) throw new Error("La respuesta no incluyó una cookie de sesión");
  return cookie;
}

function validAutomation(lineId = FIXTURE_IDS.lineA) {
  return {
    lineId,
    name: "Automatización autorizada",
    type: "VENTA",
    groupIds: [FIXTURE_IDS.groupA],
    triggers: [{ content: "Mensaje", scheduledAt: "2027-01-01T15:00:00.000Z" }],
  };
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("authentication and authorization", () => {
  it("inicia sesión con credenciales válidas y no expone passwordHash", async () => {
    const { app: instance, repository } = await setup();
    const response = await login(instance, "ADMIN@example.com", "admin");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ user: { email: "admin@example.com", name: "Admin" } });
    expect(response.body).not.toContain("passwordHash");
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Lax");
    expect(response.headers["set-cookie"]).not.toContain(repository.sessions[0]?.tokenHash);
  });

  it("marca la cookie como Secure cuando se configura para producción", async () => {
    const repository = new InMemoryAppRepository();
    app = await buildApp({ repository, healthCheck: async () => undefined, allowedOrigins: [], passwordHasher, secureCookie: true });
    const response = await login(app, "admin@example.com", "admin");
    const logout = await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie: cookieFrom(response) } });
    expect(response.headers["set-cookie"]).toContain("Secure");
    expect(logout.headers["set-cookie"]).toContain("HttpOnly");
    expect(logout.headers["set-cookie"]).toContain("Secure");
    expect(logout.headers["set-cookie"]).toContain("SameSite=Lax");
    expect(logout.headers["set-cookie"]).toContain("Path=/");
    expect(logout.headers["set-cookie"]).toContain("Max-Age=0");
  });

  it.each([
    ["credenciales incorrectas", "admin@example.com", "incorrecta"],
    ["usuario inactivo", "inactive@example.com", "inactive"],
  ])("rechaza %s con el mismo mensaje público", async (_case, email, password) => {
    const { app: instance } = await setup();
    const response = await login(instance, email, password);

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: { code: "INVALID_CREDENTIALS", message: "Correo o contraseña incorrectos" } });
  });

  it("limita intentos repetidos de login", async () => {
    const { app: instance } = await setup();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await login(instance, "admin@example.com", "incorrecta");
      expect(response.statusCode).toBe(401);
    }
    const blocked = await login(instance, "admin@example.com", "incorrecta");
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toEqual({ error: { code: "RATE_LIMITED", message: "Demasiados intentos. Espera antes de volver a intentarlo" } });
  });

  it("acepta una sesión válida en auth/me", async () => {
    const { app: instance } = await setup();
    const loggedIn = await login(instance, "admin@example.com", "admin");
    const response = await instance.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: cookieFrom(loggedIn) } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ user: { id: FIXTURE_IDS.admin } });
  });

  it.each(["expired", "revoked"] as const)("rechaza una sesión %s", async (state) => {
    const { app: instance, repository } = await setup();
    const loggedIn = await login(instance, "admin@example.com", "admin");
    const session = repository.sessions[0];
    if (!session) throw new Error("No se creó la sesión esperada");
    if (state === "expired") session.expiresAt = new Date(Date.now() - 1_000);
    else session.revokedAt = new Date();

    const response = await instance.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: cookieFrom(loggedIn) } });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: "SESSION_INVALID" } });
  });

  it("revoca la sesión al cerrar sesión", async () => {
    const { app: instance, repository } = await setup();
    const loggedIn = await login(instance, "admin@example.com", "admin");
    const cookie = cookieFrom(loggedIn);
    const logout = await instance.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie } });
    const repeatedLogout = await instance.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie } });
    const me = await instance.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie } });

    expect(logout.statusCode).toBe(200);
    expect(repeatedLogout.statusCode).toBe(200);
    expect(repository.sessions[0]?.revokedAt).toBeInstanceOf(Date);
    expect(me.statusCode).toBe(401);
  });

  it("protege rutas sin sesión", async () => {
    const { app: instance } = await setup();
    const response = await instance.inject({ method: "GET", url: "/api/v1/lines" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: "AUTH_REQUIRED" } });
  });

  it("oculta líneas no asignadas por UUID directo", async () => {
    const { app: instance } = await setup();
    const loggedIn = await login(instance, "operator@example.com", "operator");
    const response = await instance.inject({ method: "GET", url: `/api/v1/lines/${FIXTURE_IDS.lineB}/groups`, headers: { cookie: cookieFrom(loggedIn) } });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: "RESOURCE_NOT_FOUND" } });
  });

  it("oculta automatizaciones de otra línea aunque se conozca su UUID", async () => {
    const { app: instance } = await setup();
    const adminLogin = await login(instance, "admin@example.com", "admin");
    const created = await instance.inject({
      method: "POST",
      url: "/api/v1/automations",
      headers: { cookie: cookieFrom(adminLogin) },
      payload: {
        lineId: FIXTURE_IDS.lineB,
        name: "Privada EBIA",
        type: "VENTA",
        groupIds: [FIXTURE_IDS.groupB],
        triggers: [{ content: "Privado", scheduledAt: "2099-01-01T15:00:00.000Z" }],
      },
    });
    const id = created.json<{ data: { id: string } }>().data.id;
    const operatorLogin = await login(instance, "operator@example.com", "operator");
    const response = await instance.inject({ method: "GET", url: `/api/v1/automations/${id}`, headers: { cookie: cookieFrom(operatorLogin) } });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: "RESOURCE_NOT_FOUND" } });
  });

  it("impide que VIEWER escriba", async () => {
    const { app: instance } = await setup();
    const loggedIn = await login(instance, "viewer@example.com", "viewer");
    const response = await instance.inject({ method: "POST", url: "/api/v1/automations", headers: { cookie: cookieFrom(loggedIn) }, payload: validAutomation() });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "INSUFFICIENT_ROLE" } });
  });

  it("permite que OPERATOR escriba en su línea", async () => {
    const { app: instance } = await setup();
    const loggedIn = await login(instance, "operator@example.com", "operator");
    const response = await instance.inject({ method: "POST", url: "/api/v1/automations", headers: { cookie: cookieFrom(loggedIn) }, payload: validAutomation() });
    expect(response.statusCode).toBe(201);
  });

  it("permite que ADMIN cree una línea", async () => {
    const { app: instance } = await setup();
    const loggedIn = await login(instance, "admin@example.com", "admin");
    const response = await instance.inject({ method: "POST", url: "/api/v1/lines", headers: { cookie: cookieFrom(loggedIn) }, payload: { name: "Nueva Marca" } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ data: { name: "Nueva Marca", slug: "nueva-marca" } });
  });
});
