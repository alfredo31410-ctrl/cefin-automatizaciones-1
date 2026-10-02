import type { FastifyInstance } from "fastify";
import { AppError } from "../domain/errors.js";
import type { AppRepository } from "../repositories/app-repository.js";
import { AutomationService } from "../services/automation-service.js";
import {
  createAutomationSchema,
  idParamsSchema,
  lineParamsSchema,
  parseRequest,
  updateAutomationSchema,
} from "./validation.js";

async function requireLine(repository: AppRepository, lineId: string): Promise<void> {
  if (!await repository.getLine(lineId)) {
    throw new AppError(404, "LINE_NOT_FOUND", "Línea no encontrada");
  }
}

export function registerApiRoutes(app: FastifyInstance, repository: AppRepository): void {
  const service = new AutomationService(repository);

  app.get("/api/v1/lines", async () => ({ data: await repository.listLines() }));

  app.get("/api/v1/lines/:lineId/groups", async (request) => {
    const { lineId } = parseRequest(lineParamsSchema, request.params);
    await requireLine(repository, lineId);
    return { data: await repository.listGroups(lineId) };
  });

  app.get("/api/v1/lines/:lineId/automations", async (request) => {
    const { lineId } = parseRequest(lineParamsSchema, request.params);
    await requireLine(repository, lineId);
    return { data: await repository.listAutomations(lineId) };
  });

  app.get("/api/v1/automations/:id", async (request) => {
    const { id } = parseRequest(idParamsSchema, request.params);
    const automation = await repository.getAutomation(id);
    if (!automation) throw new AppError(404, "AUTOMATION_NOT_FOUND", "Automatización no encontrada");
    return { data: automation };
  });

  app.post("/api/v1/automations", async (request, reply) => {
    const payload = parseRequest(createAutomationSchema, request.body);
    const automation = await service.create(payload);
    return reply.code(201).send({ data: automation });
  });

  app.patch("/api/v1/automations/:id", async (request) => {
    const { id } = parseRequest(idParamsSchema, request.params);
    const payload = parseRequest(updateAutomationSchema, request.body);
    return { data: await service.update(id, payload) };
  });

  app.post("/api/v1/automations/:id/duplicate", async (request, reply) => {
    const { id } = parseRequest(idParamsSchema, request.params);
    return reply.code(201).send({ data: await service.duplicate(id) });
  });

  app.post("/api/v1/automations/:id/pause", async (request) => {
    const { id } = parseRequest(idParamsSchema, request.params);
    return { data: await service.pause(id) };
  });

  app.post("/api/v1/automations/:id/resume", async (request) => {
    const { id } = parseRequest(idParamsSchema, request.params);
    return { data: await service.resume(id) };
  });

  app.post("/api/v1/automations/:id/cancel", async (request) => {
    const { id } = parseRequest(idParamsSchema, request.params);
    return { data: await service.cancel(id) };
  });

  app.get("/api/v1/lines/:lineId/events", async (request) => {
    const { lineId } = parseRequest(lineParamsSchema, request.params);
    await requireLine(repository, lineId);
    return { data: await repository.listEvents(lineId) };
  });
}
