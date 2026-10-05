import type { FastifyInstance } from "fastify";
import { filterAccessibleLineIds, requireGlobalAdmin, requireLineRole } from "../auth/authorization.js";
import { AppError } from "../domain/errors.js";
import type { AppRepository } from "../repositories/app-repository.js";
import { AutomationService } from "../services/automation-service.js";
import { LineService } from "../services/line-service.js";
import {
  createAutomationSchema,
  createLineSchema,
  idParamsSchema,
  lineParamsSchema,
  parseRequest,
  simulateTriggerSchema,
  triggerParamsSchema,
  updateAutomationSchema,
  updateLineSchema,
} from "./validation.js";

async function requireAutomation(repository: AppRepository, id: string) {
  const automation = await repository.getAutomation(id);
  if (!automation) throw new AppError(404, "AUTOMATION_NOT_FOUND", "Automatización no encontrada");
  return automation;
}

export function registerApiRoutes(app: FastifyInstance, repository: AppRepository): void {
  const automationService = new AutomationService(repository);
  const lineService = new LineService(repository);

  app.get("/lines", async (request) => {
    const lineIds = filterAccessibleLineIds(request.auth.user);
    const allLines = await repository.listLines();
    return { data: lineIds ? allLines.filter((line) => lineIds.has(line.id)) : allLines };
  });

  app.post("/lines", async (request, reply) => {
    requireGlobalAdmin(request.auth.user);
    const payload = parseRequest(createLineSchema, request.body);
    return reply.code(201).send({ data: await lineService.create(payload.name, request.auth.user.id) });
  });

  app.patch("/lines/:lineId", async (request) => {
    requireGlobalAdmin(request.auth.user);
    const { lineId } = parseRequest(lineParamsSchema, request.params);
    const payload = parseRequest(updateLineSchema, request.body);
    return { data: await lineService.update(lineId, payload, request.auth.user.id) };
  });

  app.get("/lines/:lineId/groups", async (request) => {
    const { lineId } = parseRequest(lineParamsSchema, request.params);
    requireLineRole(request.auth.user, lineId, "VIEWER");
    return { data: await repository.listGroups(lineId) };
  });

  app.get("/lines/:lineId/automations", async (request) => {
    const { lineId } = parseRequest(lineParamsSchema, request.params);
    requireLineRole(request.auth.user, lineId, "VIEWER");
    return { data: await repository.listAutomations(lineId) };
  });

  app.get("/automations/:id", async (request) => {
    const { id } = parseRequest(idParamsSchema, request.params);
    const automation = await requireAutomation(repository, id);
    requireLineRole(request.auth.user, automation.lineId, "VIEWER");
    return { data: automation };
  });

  app.post("/automations", async (request, reply) => {
    const payload = parseRequest(createAutomationSchema, request.body);
    requireLineRole(request.auth.user, payload.lineId, "OPERATOR");
    const automation = await automationService.create(payload, request.auth.user.id);
    return reply.code(201).send({ data: automation });
  });

  app.patch("/automations/:id", async (request) => {
    const { id } = parseRequest(idParamsSchema, request.params);
    const current = await requireAutomation(repository, id);
    requireLineRole(request.auth.user, current.lineId, "OPERATOR");
    const payload = parseRequest(updateAutomationSchema, request.body);
    return { data: await automationService.update(id, payload, request.auth.user.id) };
  });

  app.post("/automations/:id/duplicate", async (request, reply) => {
    const { id } = parseRequest(idParamsSchema, request.params);
    const current = await requireAutomation(repository, id);
    requireLineRole(request.auth.user, current.lineId, "OPERATOR");
    return reply.code(201).send({ data: await automationService.duplicate(id, request.auth.user.id) });
  });

  app.post("/automations/:id/pause", async (request) => {
    const { id } = parseRequest(idParamsSchema, request.params);
    const current = await requireAutomation(repository, id);
    requireLineRole(request.auth.user, current.lineId, "OPERATOR");
    return { data: await automationService.pause(id, request.auth.user.id) };
  });

  app.post("/automations/:id/resume", async (request) => {
    const { id } = parseRequest(idParamsSchema, request.params);
    const current = await requireAutomation(repository, id);
    requireLineRole(request.auth.user, current.lineId, "OPERATOR");
    return { data: await automationService.resume(id, request.auth.user.id) };
  });

  app.post("/automations/:id/cancel", async (request) => {
    const { id } = parseRequest(idParamsSchema, request.params);
    const current = await requireAutomation(repository, id);
    requireLineRole(request.auth.user, current.lineId, "OPERATOR");
    return { data: await automationService.cancel(id, request.auth.user.id) };
  });

  app.post("/automations/:id/triggers/:triggerId/simulate", async (request) => {
    const { id, triggerId } = parseRequest(triggerParamsSchema, request.params);
    const current = await requireAutomation(repository, id);
    requireLineRole(request.auth.user, current.lineId, "OPERATOR");
    const { status } = parseRequest(simulateTriggerSchema, request.body);
    return { data: await repository.simulateTrigger(id, triggerId, status, request.auth.user.id) };
  });

  app.get("/lines/:lineId/events", async (request) => {
    const { lineId } = parseRequest(lineParamsSchema, request.params);
    requireLineRole(request.auth.user, lineId, "VIEWER");
    return { data: await repository.listEvents(lineId) };
  });
}
