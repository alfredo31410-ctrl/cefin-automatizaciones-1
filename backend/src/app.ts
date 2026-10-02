import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { AppError } from "./domain/errors.js";
import { registerApiRoutes } from "./http/routes.js";
import type { AppRepository } from "./repositories/app-repository.js";

interface BuildAppOptions {
  repository: AppRepository;
  healthCheck: () => Promise<void>;
  allowedOrigins: string[];
  logger?: boolean;
  onClose?: () => Promise<void>;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || options.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
    }

    request.log.error({ err: error }, "Unhandled request error");
    return reply.code(500).send({
      error: { code: "INTERNAL_ERROR", message: "Ocurrió un error interno" },
    });
  });

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({
    error: { code: "ROUTE_NOT_FOUND", message: "Ruta no encontrada" },
  }));

  app.get("/health", async (_request, reply) => {
    try {
      await options.healthCheck();
      return { status: "ok", database: "connected" };
    } catch {
      return reply.code(503).send({ status: "error", database: "disconnected" });
    }
  });

  registerApiRoutes(app, options.repository);

  if (options.onClose) {
    app.addHook("onClose", options.onClose);
  }

  return app;
}
