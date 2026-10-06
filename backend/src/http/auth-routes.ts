import type { FastifyInstance } from "fastify";
import type { AuthService } from "../auth/auth-service.js";
import { expiredSessionCookieOptions, SESSION_COOKIE_NAME, sessionCookieOptions } from "../auth/session.js";
import { loginSchema, parseRequest } from "./validation.js";

export interface AuthRouteOptions {
  service: AuthService;
  secureCookie: boolean;
  sessionTtlHours: number;
}

export function registerAuthRoutes(app: FastifyInstance, options: AuthRouteOptions): void {
  const maxAgeSeconds = options.sessionTtlHours * 60 * 60;
  const cookieOptions = sessionCookieOptions(options.secureCookie, maxAgeSeconds);

  app.post("/auth/login", {
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
  }, async (request, reply) => {
    const { email, password } = parseRequest(loginSchema, request.body);
    const result = await options.service.login(email, password);
    return reply.setCookie(SESSION_COOKIE_NAME, result.token, cookieOptions).send({
      user: result.user,
      expiresAt: result.expiresAt,
    });
  });

  app.post("/auth/logout", async (request, reply) => {
    await options.service.logout(request.cookies[SESSION_COOKIE_NAME]);
    return reply.clearCookie(SESSION_COOKIE_NAME, expiredSessionCookieOptions(options.secureCookie)).send({ ok: true });
  });

  app.get("/auth/me", async (request) => {
    const principal = await options.service.authenticate(request.cookies[SESSION_COOKIE_NAME]);
    return { user: principal.user, expiresAt: principal.expiresAt };
  });
}
