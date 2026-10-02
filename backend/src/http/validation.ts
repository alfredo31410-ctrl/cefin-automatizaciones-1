import { z } from "zod";
import { AppError } from "../domain/errors.js";
import { AUTOMATION_TYPES } from "../domain/types.js";

export const idParamsSchema = z.object({ id: z.uuid() });
export const lineParamsSchema = z.object({ lineId: z.uuid() });

const triggerSchema = z.object({
  content: z.string().trim().min(1).max(10_000),
  scheduledAt: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
  attachmentMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const createAutomationSchema = z.object({
  lineId: z.uuid(),
  name: z.string().trim().min(1).max(240),
  type: z.enum(AUTOMATION_TYPES),
  groupIds: z.array(z.uuid()).min(1).max(500),
  triggers: z.array(triggerSchema).min(1).max(500),
  activate: z.boolean().optional().default(false),
}).strict();

export const updateAutomationSchema = z.object({
  name: z.string().trim().min(1).max(240).optional(),
  type: z.enum(AUTOMATION_TYPES).optional(),
  groupIds: z.array(z.uuid()).min(1).max(500).optional(),
  triggers: z.array(triggerSchema).min(1).max(500).optional(),
}).strict().refine((payload) => Object.keys(payload).length > 0, "Debe enviarse al menos un campo");

export function parseRequest<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "La solicitud contiene datos inválidos");
  }
  return result.data;
}
