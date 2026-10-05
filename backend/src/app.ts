import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { AuthService } from "./auth/auth-service.js";
import type { PasswordHasher } from "./auth/password.js";
import { SESSION_COOKIE_NAME } from "./auth/session.js";
import { AppError } from "./domain/errors.js";
import { registerAuthRoutes } from "./http/auth-routes.js";
import { registerApiRoutes } from "./http/routes.js";
import type { AppRepository } from "./repositories/app-repository.js";
import type { AuthRepository } from "./repositories/auth-repository.js";

interface BuildAppOptions {
  repository: AppRepository & AuthRepository;
  healthCheck: () => Promise<void>;
  allowedOrigins: string[];
  sessionTtlHours?: number;
  secureCookie?: boolean;
  passwordHasher?: PasswordHasher;
  logger?: boolean;
  onClose?: () => Promise<void>;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });

  await app.register(cookie);
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => new AppError(429, "RATE_LIMITED", "Demasiados intentos. Espera antes de volver a intentarlo"),
  });

  await app.register(cors, {
    credentials: true,
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

  const sessionTtlHours = options.sessionTtlHours ?? 8;
  const authService = new AuthService(options.repository, sessionTtlHours, options.passwordHasher);
  await app.register(async (api) => {
    registerAuthRoutes(api, {
      service: authService,
      secureCookie: options.secureCookie ?? false,
      sessionTtlHours,
    });

    await api.register((protectedApi, _pluginOptions, done) => {
      protectedApi.decorateRequest("auth");
      protectedApi.addHook("preHandler", async (request) => {
        request.auth = await authService.authenticate(request.cookies[SESSION_COOKIE_NAME]);
      });
      registerApiRoutes(protectedApi, options.repository);
      done();
    });
  }, { prefix: "/api/v1" });

  if (options.onClose) {
    app.addHook("onClose", options.onClose);
  }

  return app;
}
