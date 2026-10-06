import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.string().trim().min(1, "DATABASE_URL es obligatoria"),
  APP_ORIGIN: z.string().trim().default("http://localhost:3000"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  HOST: z.string().trim().default("0.0.0.0"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(8),
  SESSION_COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const workerEnvironmentSchema = z.object({
  DATABASE_URL: z.string().trim().min(1, "DATABASE_URL es obligatoria"),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(1_000).max(300_000).default(5_000),
  WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Environment = z.infer<typeof environmentSchema>;
export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>;

function configurationError(result: { error: z.ZodError }): Error {
  const details = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  return new Error(`Configuración inválida: ${details}`);
}

export function readEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const result = environmentSchema.safeParse(source);

  if (!result.success) throw configurationError(result);

  return result.data;
}

export function readWorkerEnvironment(source: NodeJS.ProcessEnv = process.env): WorkerEnvironment {
  const result = workerEnvironmentSchema.safeParse(source);
  if (!result.success) throw configurationError(result);
  return result.data;
}

export function useSecureSessionCookie(environment: Environment): boolean {
  if (environment.SESSION_COOKIE_SECURE) return environment.SESSION_COOKIE_SECURE === "true";
  return environment.NODE_ENV === "production";
}

export function parseAllowedOrigins(value: string): string[] {
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
}
