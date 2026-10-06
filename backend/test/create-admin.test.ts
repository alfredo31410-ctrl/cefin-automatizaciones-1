import { describe, expect, it } from "vitest";
import type { PasswordHasher } from "../src/auth/password.js";
import {
  AdminConfigurationError,
  adminSuccessMessage,
  parseAdminVariables,
  provisionAdmin,
  type AdminSaveInput,
  type AdminStore,
} from "../src/db/admin-provisioning.js";

const validEnvironment = {
  ADMIN_EMAIL: "admin@example.com",
  ADMIN_NAME: "Administrador",
  ADMIN_PASSWORD: "123456789012",
};

class TestPasswordHasher implements PasswordHasher {
  readonly inputs: string[] = [];

  async hash(password: string): Promise<string> {
    this.inputs.push(password);
    return "$argon2id$test-hash";
  }

  async verify(): Promise<boolean> {
    return false;
  }
}

class InMemoryAdminStore implements AdminStore {
  readonly users = new Map<string, AdminSaveInput>();
  readonly assignments = new Map<string, Map<string, "ADMIN">>();
  readonly lineIds = ["line-1", "line-2"];

  async saveAdmin(input: AdminSaveInput) {
    const created = !this.users.has(input.email);
    this.users.set(input.email, input);
    const roles = this.assignments.get(input.email) ?? new Map<string, "ADMIN">();
    for (const lineId of this.lineIds) roles.set(lineId, input.role);
    this.assignments.set(input.email, roles);
    return { created, assignedLineCount: this.lineIds.length };
  }
}

function expectConfigurationError(source: NodeJS.ProcessEnv, message: string): void {
  expect(() => parseAdminVariables(source)).toThrow(new AdminConfigurationError(message));
}

describe("create-admin", () => {
  it("acepta variables válidas", () => {
    expect(parseAdminVariables(validEnvironment)).toEqual({
      email: "admin@example.com",
      name: "Administrador",
      password: "123456789012",
    });
  });

  it("rechaza ADMIN_EMAIL ausente", () => {
    expectConfigurationError({ ...validEnvironment, ADMIN_EMAIL: undefined }, "ADMIN_EMAIL es obligatorio.");
  });

  it("rechaza ADMIN_NAME ausente", () => {
    expectConfigurationError({ ...validEnvironment, ADMIN_NAME: undefined }, "ADMIN_NAME es obligatorio.");
  });

  it("rechaza ADMIN_PASSWORD ausente", () => {
    expectConfigurationError({ ...validEnvironment, ADMIN_PASSWORD: undefined }, "ADMIN_PASSWORD es obligatorio.");
  });

  it("rechaza un password con menos de 12 caracteres", () => {
    expectConfigurationError({ ...validEnvironment, ADMIN_PASSWORD: "12345678901" }, "ADMIN_PASSWORD debe tener al menos 12 caracteres.");
  });

  it("rechaza un email inválido", () => {
    expectConfigurationError({ ...validEnvironment, ADMIN_EMAIL: "correo-invalido" }, "ADMIN_EMAIL no tiene un formato válido.");
  });

  it("acepta un password de exactamente 12 caracteres", () => {
    expect(parseAdminVariables({ ...validEnvironment, ADMIN_PASSWORD: "123456789012" }).password).toHaveLength(12);
  });

  it("recorta y normaliza el email antes de validarlo", () => {
    expect(parseAdminVariables({ ...validEnvironment, ADMIN_EMAIL: "  ADMIN@EXAMPLE.COM\n" }).email).toBe("admin@example.com");
  });

  it("crea un administrador activo con hash y rol ADMIN", async () => {
    const store = new InMemoryAdminStore();
    const hasher = new TestPasswordHasher();
    const admin = parseAdminVariables(validEnvironment);
    const result = await provisionAdmin(admin, store, hasher);

    expect(result).toEqual({ created: true, assignedLineCount: 2 });
    expect(hasher.inputs).toEqual([validEnvironment.ADMIN_PASSWORD]);
    expect(store.users.get(admin.email)).toMatchObject({ active: true, role: "ADMIN", passwordHash: "$argon2id$test-hash" });
  });

  it("es idempotente para el mismo email", async () => {
    const store = new InMemoryAdminStore();
    const hasher = new TestPasswordHasher();
    const admin = parseAdminVariables(validEnvironment);

    const first = await provisionAdmin(admin, store, hasher);
    const second = await provisionAdmin({ ...admin, name: "Nombre actualizado" }, store, hasher);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(store.users).toHaveLength(1);
    expect(store.users.get(admin.email)?.name).toBe("Nombre actualizado");
  });

  it("asigna ADMIN una sola vez a todas las líneas", async () => {
    const store = new InMemoryAdminStore();
    const admin = parseAdminVariables(validEnvironment);
    await provisionAdmin(admin, store, new TestPasswordHasher());
    await provisionAdmin(admin, store, new TestPasswordHasher());

    expect([...store.assignments.get(admin.email)?.entries() ?? []]).toEqual([
      ["line-1", "ADMIN"],
      ["line-2", "ADMIN"],
    ]);
  });

  it("no expone password ni hash en el mensaje de salida", async () => {
    const store = new InMemoryAdminStore();
    const admin = parseAdminVariables(validEnvironment);
    const result = await provisionAdmin(admin, store, new TestPasswordHasher());
    const output = adminSuccessMessage(result);

    expect(output).toBe("Administrador creado correctamente. Líneas asignadas: 2.");
    expect(output).not.toContain(validEnvironment.ADMIN_PASSWORD);
    expect(output).not.toContain("$argon2id$test-hash");
    expect(output).not.toContain(admin.email);
  });
});
