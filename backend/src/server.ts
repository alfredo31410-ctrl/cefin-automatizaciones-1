import { buildApp } from "./app.js";
import { parseAllowedOrigins, readEnvironment, useSecureSessionCookie } from "./config/env.js";
import { createDatabaseConnection } from "./db/client.js";
import { PostgresAppRepository } from "./repositories/postgres-app-repository.js";

async function main(): Promise<void> {
  const environment = readEnvironment();
  const connection = createDatabaseConnection(environment.DATABASE_URL);
  const app = await buildApp({
    repository: new PostgresAppRepository(connection.db),
    healthCheck: connection.healthCheck,
    allowedOrigins: parseAllowedOrigins(environment.APP_ORIGIN),
    sessionTtlHours: environment.SESSION_TTL_HOURS,
    secureCookie: useSecureSessionCookie(environment),
    logger: true,
    onClose: connection.close,
  });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, "Shutting down");
    await app.close();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ host: environment.HOST, port: environment.PORT });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "No se pudo iniciar el backend");
  process.exit(1);
});
