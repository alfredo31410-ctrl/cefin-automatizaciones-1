import { z } from "zod";
import type { PasswordHasher } from "../auth/password.js";

export interface AdminVariables {
  email: string;
  name: string;
  password: string;
}

export interface AdminSaveInput {
  email: string;
  name: string;
  passwordHash: string;
  active: true;
  role: "ADMIN";
}

export interface AdminSaveResult {
  created: boolean;
  assignedLineCount: number;
}

export interface AdminStore {
  saveAdmin(input: AdminSaveInput): Promise<AdminSaveResult>;
}

export class AdminConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminConfigurationError";
  }
}

function requiredValue(value: string | undefined, variable: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new AdminConfigurationError(`${variable} es obligatorio.`);
  }
  return value;
}

export function parseAdminVariables(source: NodeJS.ProcessEnv): AdminVariables {
  const email = requiredValue(source.ADMIN_EMAIL, "ADMIN_EMAIL").trim().toLowerCase();
  if (!z.email().max(320).safeParse(email).success) {
    throw new AdminConfigurationError("ADMIN_EMAIL no tiene un formato válido.");
  }

  const name = requiredValue(source.ADMIN_NAME, "ADMIN_NAME").trim();
  if (name.length < 2) {
    throw new AdminConfigurationError("ADMIN_NAME debe tener al menos 2 caracteres.");
  }
  if (name.length > 160) {
    throw new AdminConfigurationError("ADMIN_NAME no puede exceder 160 caracteres.");
  }

  const password = requiredValue(source.ADMIN_PASSWORD, "ADMIN_PASSWORD");
  if (password.length < 12) {
    throw new AdminConfigurationError("ADMIN_PASSWORD debe tener al menos 12 caracteres.");
  }
  if (password.length > 1_024) {
    throw new AdminConfigurationError("ADMIN_PASSWORD no puede exceder 1024 caracteres.");
  }

  return { email, name, password };
}

export async function provisionAdmin(
  variables: AdminVariables,
  store: AdminStore,
  passwordHasher: PasswordHasher,
): Promise<AdminSaveResult> {
  const passwordHash = await passwordHasher.hash(variables.password);
  return store.saveAdmin({
    email: variables.email,
    name: variables.name,
    passwordHash,
    active: true,
    role: "ADMIN",
  });
}

export function adminSuccessMessage(result: AdminSaveResult): string {
  const action = result.created ? "creado" : "actualizado";
  return `Administrador ${action} correctamente. Líneas asignadas: ${result.assignedLineCount}.`;
}
