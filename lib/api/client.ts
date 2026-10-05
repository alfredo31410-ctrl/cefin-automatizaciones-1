import type { AutomationInput, Line } from "@/lib/domain/types";

export interface UserLineAccess {
  lineId: string;
  role: "ADMIN" | "OPERATOR" | "VIEWER";
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  lineAccess: UserLineAccess[];
}

export interface ApiGroup {
  id: string;
  lineId: string;
  name: string;
  externalId: string | null;
  memberCount: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiTrigger {
  id: string;
  automationId: string;
  content: string;
  scheduledAt: string;
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED";
  attachmentMetadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiAutomation {
  id: string;
  lineId: string;
  name: string;
  type: "PREVENTA" | "VENTA" | "RETARGETING" | "CALENTAMIENTO";
  status: "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ERROR" | "CANCELLED";
  groupIds: string[];
  triggers: ApiTrigger[];
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  finishedAt: string | null;
  resumeStatus: "ACTIVE" | "SCHEDULED" | null;
}

export interface ApiEvent {
  id: string;
  lineId: string;
  automationId: string | null;
  userId: string | null;
  event: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

const API_PREFIX = "/api/backend/api/v1";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      ...init,
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(503, "API_UNAVAILABLE", "La API no está disponible en este momento");
  }

  const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
  if (!response.ok) {
    throw new ApiError(response.status, body?.error?.code ?? "API_ERROR", body?.error?.message ?? "No fue posible completar la solicitud");
  }
  return body as T;
}

function automationBody(lineId: string, input: AutomationInput, activate?: boolean) {
  return {
    lineId,
    name: input.name,
    type: input.type,
    groupIds: input.groupIds,
    triggers: input.triggers.map((trigger) => ({
      content: trigger.content,
      scheduledAt: trigger.scheduledAt,
      attachmentMetadata: trigger.attachment ?? null,
    })),
    activate: activate ?? false,
  };
}

export const apiClient = {
  login: (email: string, password: string) => apiFetch<{ user: AuthenticatedUser; expiresAt: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => apiFetch<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => apiFetch<{ user: AuthenticatedUser; expiresAt: string }>("/auth/me"),
  listLines: () => apiFetch<{ data: Line[] }>("/lines"),
  createLine: (name: string) => apiFetch<{ data: Line }>("/lines", { method: "POST", body: JSON.stringify({ name }) }),
  updateLine: (lineId: string, input: { name?: string; active?: boolean }) => apiFetch<{ data: Line }>(`/lines/${lineId}`, { method: "PATCH", body: JSON.stringify(input) }),
  listGroups: (lineId: string) => apiFetch<{ data: ApiGroup[] }>(`/lines/${lineId}/groups`),
  listAutomations: (lineId: string) => apiFetch<{ data: ApiAutomation[] }>(`/lines/${lineId}/automations`),
  listEvents: (lineId: string) => apiFetch<{ data: ApiEvent[] }>(`/lines/${lineId}/events`),
  createAutomation: (lineId: string, input: AutomationInput, activate?: boolean) => apiFetch<{ data: ApiAutomation }>("/automations", { method: "POST", body: JSON.stringify(automationBody(lineId, input, activate)) }),
  updateAutomation: (id: string, lineId: string, input: AutomationInput, activate?: boolean) => {
    const { lineId: _lineId, ...body } = automationBody(lineId, input, activate);
    void _lineId;
    return apiFetch<{ data: ApiAutomation }>(`/automations/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },
  duplicateAutomation: (id: string) => apiFetch<{ data: ApiAutomation }>(`/automations/${id}/duplicate`, { method: "POST" }),
  pauseAutomation: (id: string) => apiFetch<{ data: ApiAutomation }>(`/automations/${id}/pause`, { method: "POST" }),
  resumeAutomation: (id: string) => apiFetch<{ data: ApiAutomation }>(`/automations/${id}/resume`, { method: "POST" }),
  cancelAutomation: (id: string) => apiFetch<{ data: ApiAutomation }>(`/automations/${id}/cancel`, { method: "POST" }),
  simulateTrigger: (automationId: string, triggerId: string, status: "SENT" | "FAILED") => apiFetch<{ data: ApiAutomation }>(`/automations/${automationId}/triggers/${triggerId}/simulate`, { method: "POST", body: JSON.stringify({ status }) }),
};
