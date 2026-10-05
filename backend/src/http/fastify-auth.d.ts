import type { SessionPrincipal } from "../domain/types.js";

declare module "fastify" {
  interface FastifyRequest {
    auth: SessionPrincipal;
  }
}
