import { AppError } from "../domain/errors.js";
import type {
  AutomationRecord,
  AutomationStatus,
  AutomationType,
  AutomationWrite,
  TriggerInput,
} from "../domain/types.js";
import type { AppRepository } from "../repositories/app-repository.js";

export interface AutomationPayload {
  lineId: string;
  name: string;
  type: AutomationType;
  groupIds: string[];
  triggers: TriggerInput[];
  activate?: boolean;
}

export interface AutomationPatch {
  name?: string;
  type?: AutomationType;
  groupIds?: string[];
  triggers?: TriggerInput[];
  activate?: boolean;
}

export class AutomationService {
  constructor(private readonly repository: AppRepository) {}

  async create(payload: AutomationPayload, actorId: string): Promise<AutomationRecord> {
    await this.assertLineAndGroups(payload.lineId, payload.groupIds);
    const status = this.initialStatus(payload.activate ?? false, payload.triggers);
    const now = new Date();

    return this.repository.createAutomation({
      ...payload,
      createdBy: actorId,
      status,
      activatedAt: status === "ACTIVE" || status === "SCHEDULED" ? now : null,
      event: "AUTOMATION_CREATED",
      eventDescription: `Automatización “${payload.name}” creada`,
    });
  }

  async update(id: string, patch: AutomationPatch, actorId: string): Promise<AutomationRecord> {
    const current = await this.requireAutomation(id);
    if (["COMPLETED", "CANCELLED"].includes(current.status)) {
      throw new AppError(409, "AUTOMATION_FINAL", "Una automatización finalizada o cancelada no se puede editar");
    }

    const groupIds = patch.groupIds ?? current.groupIds;
    await this.assertLineAndGroups(current.lineId, groupIds);

    const input: AutomationWrite = {
      lineId: current.lineId,
      name: patch.name ?? current.name,
      type: patch.type ?? current.type,
      status: patch.activate ? this.initialStatus(true, patch.triggers ?? current.triggers) : current.status,
      createdBy: actorId,
      groupIds,
      triggers: patch.triggers ?? current.triggers.map((trigger) => ({
        id: trigger.id,
        content: trigger.content,
        scheduledAt: trigger.scheduledAt,
        status: trigger.status,
        attachmentMetadata: trigger.attachmentMetadata,
      })),
      activatedAt: patch.activate ? current.activatedAt ?? new Date() : current.activatedAt,
      finishedAt: current.finishedAt,
      resumeStatus: current.resumeStatus,
      event: patch.activate ? "AUTOMATION_ACTIVATED" : "AUTOMATION_UPDATED",
      eventDescription: patch.activate
        ? `Automatización “${patch.name ?? current.name}” activada`
        : `Automatización “${patch.name ?? current.name}” actualizada`,
    };

    return this.repository.updateAutomation(id, input);
  }

  async duplicate(id: string, actorId: string): Promise<AutomationRecord> {
    const current = await this.requireAutomation(id);
    await this.assertLineAndGroups(current.lineId, current.groupIds);

    return this.repository.createAutomation({
      lineId: current.lineId,
      name: `${current.name} (copia)`,
      type: current.type,
      status: "DRAFT",
      createdBy: actorId,
      groupIds: current.groupIds,
      triggers: current.triggers.map((trigger) => ({
        content: trigger.content,
        scheduledAt: trigger.scheduledAt,
        status: "PENDING",
        attachmentMetadata: trigger.attachmentMetadata,
      })),
      event: "AUTOMATION_DUPLICATED",
      eventDescription: `Automatización duplicada desde “${current.name}”`,
      eventMetadata: { sourceAutomationId: current.id },
    });
  }

  async pause(id: string, actorId: string): Promise<AutomationRecord> {
    const current = await this.requireAutomation(id);
    if (current.status !== "ACTIVE" && current.status !== "SCHEDULED") {
      throw new AppError(409, "INVALID_STATUS_TRANSITION", "Solo se puede pausar una automatización activa o programada");
    }

    return this.repository.transitionAutomation(id, {
      status: "PAUSED",
      resumeStatus: current.status,
      event: "AUTOMATION_PAUSED",
      description: `Automatización “${current.name}” pausada`,
      actorId,
    });
  }

  async resume(id: string, actorId: string): Promise<AutomationRecord> {
    const current = await this.requireAutomation(id);
    if (current.status !== "PAUSED") {
      throw new AppError(409, "INVALID_STATUS_TRANSITION", "Solo se puede reanudar una automatización pausada");
    }

    const status: AutomationStatus = current.resumeStatus ?? this.initialStatus(true, current.triggers);
    return this.repository.transitionAutomation(id, {
      status,
      resumeStatus: null,
      activatedAt: current.activatedAt ?? new Date(),
      event: "AUTOMATION_RESUMED",
      description: `Automatización “${current.name}” reanudada`,
      actorId,
    });
  }

  async cancel(id: string, actorId: string): Promise<AutomationRecord> {
    const current = await this.requireAutomation(id);
    if (current.status === "COMPLETED" || current.status === "CANCELLED") {
      throw new AppError(409, "INVALID_STATUS_TRANSITION", "La automatización ya está finalizada o cancelada");
    }

    return this.repository.transitionAutomation(id, {
      status: "CANCELLED",
      resumeStatus: null,
      finishedAt: new Date(),
      cancelPendingTriggers: true,
      event: "AUTOMATION_CANCELLED",
      description: `Automatización “${current.name}” cancelada`,
      actorId,
    });
  }

  private async requireAutomation(id: string): Promise<AutomationRecord> {
    const automation = await this.repository.getAutomation(id);
    if (!automation) {
      throw new AppError(404, "AUTOMATION_NOT_FOUND", "Automatización no encontrada");
    }
    return automation;
  }

  private async assertLineAndGroups(lineId: string, groupIds: string[]): Promise<void> {
    const line = await this.repository.getLine(lineId);
    if (!line) {
      throw new AppError(404, "LINE_NOT_FOUND", "Línea no encontrada");
    }
    if (!line.active) {
      throw new AppError(409, "LINE_INACTIVE", "La línea está inactiva");
    }

    const uniqueGroupIds = new Set(groupIds);
    if (uniqueGroupIds.size !== groupIds.length) {
      throw new AppError(400, "DUPLICATE_GROUP", "La selección de grupos contiene duplicados");
    }

    const selectedGroups = await this.repository.getGroupsByIds(groupIds);
    if (selectedGroups.length !== groupIds.length) {
      throw new AppError(400, "GROUP_NOT_FOUND", "Uno o más grupos no existen");
    }
    if (selectedGroups.some((group) => group.lineId !== lineId)) {
      throw new AppError(400, "CROSS_LINE_GROUP", "Todos los grupos deben pertenecer a la misma línea que la automatización");
    }
    if (selectedGroups.some((group) => !group.active)) {
      throw new AppError(400, "GROUP_INACTIVE", "No se pueden seleccionar grupos inactivos");
    }
  }

  private initialStatus(activate: boolean, triggers: TriggerInput[]): AutomationStatus {
    if (!activate) return "DRAFT";
    return triggers.some((trigger) => trigger.scheduledAt.getTime() > Date.now()) ? "SCHEDULED" : "ACTIVE";
  }
}
