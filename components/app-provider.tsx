"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  apiClient,
  ApiError,
  type ApiAutomation,
  type ApiEvent,
  type ApiGroup,
  type AuthenticatedUser,
} from "@/lib/api/client";
import type { AppDatabase, Attachment, Automation, AutomationInput, EventLog, Group, Line } from "@/lib/domain/types";

interface AppContextValue {
  database: AppDatabase | null;
  user: AuthenticatedUser | null;
  selectedLineId: string;
  selectedLine: Line | null;
  loading: boolean;
  saving: boolean;
  error: string;
  isAdmin: boolean;
  canWriteSelectedLine: boolean;
  selectLine: (id: string) => Promise<void>;
  createLine: (name: string) => Promise<string>;
  renameLine: (id: string, name: string) => Promise<void>;
  toggleLineActive: (id: string) => Promise<void>;
  saveAutomation: (input: AutomationInput, options?: { id?: string; activate?: boolean }) => Promise<string>;
  duplicateAutomation: (id: string) => Promise<string>;
  togglePause: (id: string) => Promise<void>;
  cancelAutomation: (id: string) => Promise<void>;
  simulateTrigger: (automationId: string, triggerId: string, status: "SENT" | "FAILED") => Promise<void>;
  refresh: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function attachmentFromMetadata(metadata: Record<string, unknown> | null): Attachment | undefined {
  if (!metadata || typeof metadata.name !== "string") return undefined;
  return {
    name: metadata.name,
    type: typeof metadata.type === "string" ? metadata.type : undefined,
    size: typeof metadata.size === "number" ? metadata.size : undefined,
  };
}

function mapGroup(group: ApiGroup): Group {
  return {
    ...group,
    externalId: group.externalId ?? undefined,
    memberCount: group.memberCount ?? undefined,
  };
}

function mapAutomation(automation: ApiAutomation): Automation {
  return {
    id: automation.id,
    lineId: automation.lineId,
    name: automation.name,
    type: automation.type,
    status: automation.status,
    groupIds: automation.groupIds,
    triggers: automation.triggers.map((trigger) => ({
      id: trigger.id,
      automationId: trigger.automationId,
      content: trigger.content,
      scheduledAt: trigger.scheduledAt,
      status: trigger.status,
      attachment: attachmentFromMetadata(trigger.attachmentMetadata),
      createdAt: trigger.createdAt,
      updatedAt: trigger.updatedAt,
    })),
    createdAt: automation.createdAt,
    updatedAt: automation.updatedAt,
    activatedAt: automation.activatedAt ?? undefined,
    finishedAt: automation.finishedAt ?? undefined,
    resumeStatus: automation.resumeStatus ?? undefined,
  };
}

function mapEvent(event: ApiEvent, automations: Map<string, Automation>): EventLog {
  return {
    id: event.id,
    lineId: event.lineId,
    automationId: event.automationId ?? undefined,
    automationName: event.automationId ? automations.get(event.automationId)?.name ?? "Automatización" : "Sistema",
    type: event.event,
    description: event.description,
    createdAt: event.createdAt,
  };
}

function userMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "No tienes permisos suficientes para realizar esta acción.";
    if (error.status === 503) return "La API no está disponible. Intenta nuevamente en unos minutos.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [database, setDatabase] = useState<AppDatabase | null>(null);
  const databaseRef = useRef<AppDatabase | null>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [selectedLineId, setSelectedLineId] = useState("");
  const selectedLineIdRef = useRef("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (preferredLineId?: string) => {
    const [{ user: authenticatedUser }, { data: lines }] = await Promise.all([apiClient.me(), apiClient.listLines()]);
    const activeLines = lines.filter((line) => line.active);
    const nextLineId = activeLines.some((line) => line.id === preferredLineId)
      ? preferredLineId!
      : activeLines.some((line) => line.id === selectedLineIdRef.current)
        ? selectedLineIdRef.current
        : activeLines[0]?.id ?? "";

    const lineData = await Promise.all(lines.map(async (line) => {
      const [groups, automations, events] = await Promise.all([
        apiClient.listGroups(line.id),
        apiClient.listAutomations(line.id),
        apiClient.listEvents(line.id),
      ]);
      return { groups: groups.data, automations: automations.data, events: events.data };
    }));

    const groups = lineData.flatMap((item) => item.groups).map(mapGroup);
    const automations = lineData.flatMap((item) => item.automations).map(mapAutomation);
    const automationMap = new Map(automations.map((automation) => [automation.id, automation]));
    const eventLogs = lineData.flatMap((item) => item.events).map((event) => mapEvent(event, automationMap));
    const nextDatabase: AppDatabase = { lines, groups, automations, eventLogs, version: Date.now(), schemaVersion: 2 };

    databaseRef.current = nextDatabase;
    selectedLineIdRef.current = nextLineId;
    setDatabase(nextDatabase);
    setSelectedLineId(nextLineId);
    setUser(authenticatedUser);
  }, []);

  const handleFailure = useCallback((caught: unknown) => {
    if (caught instanceof ApiError && caught.status === 401) {
      router.replace("/login?reason=session");
      return;
    }
    setError(userMessage(caught));
  }, [router]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await load();
    } catch (caught) {
      handleFailure(caught);
    } finally {
      setLoading(false);
    }
  }, [handleFailure, load]);

  useEffect(() => {
    let active = true;
    // Initial client synchronization intentionally populates the provider after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((caught: unknown) => {
      if (active) handleFailure(caught);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [handleFailure, load]);

  const mutate = useCallback(async <T,>(action: () => Promise<T>, preferredLineId?: string): Promise<T> => {
    setSaving(true);
    setError("");
    try {
      const result = await action();
      await load(preferredLineId);
      return result;
    } catch (caught) {
      handleFailure(caught);
      throw caught;
    } finally {
      setSaving(false);
    }
  }, [handleFailure, load]);

  const selectLine = useCallback(async (id: string) => {
    const line = databaseRef.current?.lines.find((item) => item.id === id && item.active);
    if (!line) throw new Error("La línea seleccionada no está disponible.");
    selectedLineIdRef.current = id;
    setSelectedLineId(id);
  }, []);

  const createLine = useCallback(async (name: string) => {
    const response = await mutate(() => apiClient.createLine(name));
    await load(response.data.id);
    return response.data.id;
  }, [load, mutate]);

  const renameLine = useCallback(async (id: string, name: string) => {
    await mutate(() => apiClient.updateLine(id, { name }), selectedLineIdRef.current);
  }, [mutate]);

  const toggleLineActive = useCallback(async (id: string) => {
    const line = databaseRef.current?.lines.find((item) => item.id === id);
    if (!line) throw new Error("La línea no existe.");
    await mutate(() => apiClient.updateLine(id, { active: !line.active }));
  }, [mutate]);

  const saveAutomation = useCallback(async (input: AutomationInput, options?: { id?: string; activate?: boolean }) => {
    const lineId = selectedLineIdRef.current;
    const response = options?.id
      ? await mutate(() => apiClient.updateAutomation(options.id!, lineId, input, options.activate), lineId)
      : await mutate(() => apiClient.createAutomation(lineId, input, options?.activate), lineId);
    return response.data.id;
  }, [mutate]);

  const duplicateAutomation = useCallback(async (id: string) => {
    const response = await mutate(() => apiClient.duplicateAutomation(id), selectedLineIdRef.current);
    return response.data.id;
  }, [mutate]);

  const togglePause = useCallback(async (id: string) => {
    const automation = databaseRef.current?.automations.find((item) => item.id === id);
    if (!automation) throw new Error("La automatización no existe.");
    await mutate(() => automation.status === "PAUSED" ? apiClient.resumeAutomation(id) : apiClient.pauseAutomation(id), automation.lineId);
  }, [mutate]);

  const cancelAutomation = useCallback(async (id: string) => {
    const automation = databaseRef.current?.automations.find((item) => item.id === id);
    await mutate(() => apiClient.cancelAutomation(id), automation?.lineId);
  }, [mutate]);

  const simulateTrigger = useCallback(async (automationId: string, triggerId: string, status: "SENT" | "FAILED") => {
    const automation = databaseRef.current?.automations.find((item) => item.id === automationId);
    await mutate(() => apiClient.simulateTrigger(automationId, triggerId, status), automation?.lineId);
  }, [mutate]);

  const selectedLine = useMemo(() => database?.lines.find((line) => line.id === selectedLineId) ?? null, [database, selectedLineId]);
  const isAdmin = user?.lineAccess.some((access) => access.role === "ADMIN") ?? false;
  const selectedRole = user?.lineAccess.find((access) => access.lineId === selectedLineId)?.role;
  const canWriteSelectedLine = isAdmin || selectedRole === "OPERATOR";
  const value = useMemo<AppContextValue>(() => ({
    database, user, selectedLineId, selectedLine, loading, saving, error, isAdmin, canWriteSelectedLine,
    selectLine, createLine, renameLine, toggleLineActive, saveAutomation, duplicateAutomation,
    togglePause, cancelAutomation, simulateTrigger, refresh,
  }), [database, user, selectedLineId, selectedLine, loading, saving, error, isAdmin, canWriteSelectedLine, selectLine, createLine, renameLine, toggleLineActive, saveAutomation, duplicateAutomation, togglePause, cancelAutomation, simulateTrigger, refresh]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp debe utilizarse dentro de AppProvider.");
  return context;
}
