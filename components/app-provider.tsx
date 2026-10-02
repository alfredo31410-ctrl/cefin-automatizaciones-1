"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { sortTriggers } from "@/lib/domain/automation";
import { assertValidAppDatabase } from "@/lib/domain/database";
import { slugifyLineName } from "@/lib/domain/line";
import type { AppDatabase, Automation, AutomationInput, AutomationStatus, EventLog, EventType, Line, TriggerStatus } from "@/lib/domain/types";

interface StateResponse {
  database: AppDatabase;
  selectedLineId: string;
}

interface AppContextValue {
  database: AppDatabase | null;
  selectedLineId: string;
  selectedLine: Line | null;
  loading: boolean;
  saving: boolean;
  error: string;
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
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function logFor(automation: Automation, type: EventType, description: string): EventLog {
  return { id: newId("log"), lineId: automation.lineId, automationId: automation.id, automationName: automation.name, type, description, createdAt: new Date().toISOString() };
}

function activationStatus(automation: Pick<Automation, "triggers">): AutomationStatus {
  const first = sortTriggers(automation.triggers)[0];
  return first && new Date(first.scheduledAt).getTime() > Date.now() ? "SCHEDULED" : "ACTIVE";
}

async function getError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? fallback;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [database, setDatabase] = useState<AppDatabase | null>(null);
  const databaseRef = useRef<AppDatabase | null>(null);
  const [selectedLineId, setSelectedLineId] = useState("");
  const selectedLineIdRef = useRef("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const applyState = useCallback((next: StateResponse) => {
    databaseRef.current = next.database;
    selectedLineIdRef.current = next.selectedLineId;
    setDatabase(next.database);
    setSelectedLineId(next.selectedLineId);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) throw new Error(await getError(response, "No fue posible cargar los datos locales."));
      applyState((await response.json()) as StateResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  }, [applyState]);

  useEffect(() => {
    let active = true;
    fetch("/api/state", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await getError(response, "No fue posible cargar los datos locales."));
        return response.json() as Promise<StateResponse>;
      })
      .then((next) => { if (active) applyState(next); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Ocurrió un error inesperado."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applyState]);

  const commit = useCallback(async (updater: (current: AppDatabase) => AppDatabase) => {
    if (!databaseRef.current) throw new Error("Los datos aún no están disponibles.");
    const previous = databaseRef.current;
    let optimistic: AppDatabase;
    try {
      optimistic = updater(previous);
      assertValidAppDatabase(optimistic);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Los cambios no son válidos.";
      setError(message);
      throw caught;
    }
    databaseRef.current = optimistic;
    setDatabase(optimistic);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(optimistic) });
      if (!response.ok) throw new Error(await getError(response, "No fue posible guardar los cambios."));
      applyState((await response.json()) as StateResponse);
    } catch (caught) {
      databaseRef.current = previous;
      setDatabase(previous);
      setError(caught instanceof Error ? caught.message : "No fue posible guardar los cambios.");
      throw caught;
    } finally {
      setSaving(false);
    }
  }, [applyState]);

  const selectLine = useCallback(async (id: string) => {
    const line = databaseRef.current?.lines.find((item) => item.id === id && item.active);
    if (!line) throw new Error("La línea seleccionada no está disponible.");
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/state", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selectedLineId: id }) });
      if (!response.ok) throw new Error(await getError(response, "No fue posible cambiar de línea."));
      selectedLineIdRef.current = id;
      setSelectedLineId(id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible cambiar de línea.");
      throw caught;
    } finally {
      setSaving(false);
    }
  }, []);

  const createLine = useCallback(async (name: string) => {
    const id = newId("line");
    await commit((current) => {
      const cleanName = name.trim();
      const slug = slugifyLineName(cleanName);
      if (!cleanName || !slug) throw new Error("Escribe un nombre válido para la línea.");
      if (current.lines.some((line) => line.slug === slug)) throw new Error("Ya existe una línea con ese slug.");
      const now = new Date().toISOString();
      return { ...current, lines: [...current.lines, { id, name: cleanName, slug, active: true, createdAt: now, updatedAt: now }] };
    });
    return id;
  }, [commit]);

  const renameLine = useCallback(async (id: string, name: string) => {
    await commit((current) => {
      const cleanName = name.trim();
      const slug = slugifyLineName(cleanName);
      if (!cleanName || !slug) throw new Error("Escribe un nombre válido para la línea.");
      if (current.lines.some((line) => line.id !== id && line.slug === slug)) throw new Error("Ya existe una línea con ese slug.");
      if (!current.lines.some((line) => line.id === id)) throw new Error("La línea no existe.");
      return { ...current, lines: current.lines.map((line) => line.id === id ? { ...line, name: cleanName, slug, updatedAt: new Date().toISOString() } : line) };
    });
  }, [commit]);

  const toggleLineActive = useCallback(async (id: string) => {
    await commit((current) => {
      const selected = current.lines.find((line) => line.id === id);
      if (!selected) throw new Error("La línea no existe.");
      if (selected.active && current.lines.filter((line) => line.active).length === 1) throw new Error("No se puede desactivar la última línea activa.");
      return { ...current, lines: current.lines.map((line) => line.id === id ? { ...line, active: !line.active, updatedAt: new Date().toISOString() } : line) };
    });
  }, [commit]);

  const saveAutomation = useCallback(async (input: AutomationInput, options?: { id?: string; activate?: boolean }) => {
    const lineId = selectedLineIdRef.current;
    const id = options?.id ?? newId("automation");
    await commit((current) => {
      const line = current.lines.find((item) => item.id === lineId && item.active);
      if (!line) throw new Error("Selecciona una línea activa antes de guardar.");
      const existing = current.automations.find((item) => item.id === id);
      if (existing && existing.lineId !== lineId) throw new Error(`Esta automatización pertenece a otra línea.`);
      const uniqueGroupIds = [...new Set(input.groupIds)];
      const invalidGroup = uniqueGroupIds.find((groupId) => current.groups.find((group) => group.id === groupId)?.lineId !== lineId);
      if (invalidGroup) throw new Error("La automatización contiene un grupo de otra línea.");
      const now = new Date().toISOString();
      const triggers = sortTriggers(input.triggers.map((trigger) => {
        const previous = existing?.triggers.find((item) => item.id === trigger.id);
        return { ...trigger, id: trigger.id || newId("trigger"), automationId: id, status: previous?.status ?? "PENDING" as TriggerStatus, createdAt: previous?.createdAt ?? now, updatedAt: now };
      }));
      const base: Automation = { id, lineId, name: input.name.trim(), type: input.type, groupIds: uniqueGroupIds, triggers, status: existing?.status ?? "DRAFT", createdAt: existing?.createdAt ?? now, updatedAt: now, activatedAt: existing?.activatedAt, finishedAt: existing?.finishedAt, resumeStatus: existing?.resumeStatus };
      if (options?.activate) { base.status = activationStatus(base); base.activatedAt = existing?.activatedAt ?? now; }
      else if (!existing) base.status = "DRAFT";
      const eventType: EventType = options?.activate ? "AUTOMATION_ACTIVATED" : existing ? "AUTOMATION_UPDATED" : "AUTOMATION_CREATED";
      const description = options?.activate ? `Se activó con ${base.groupIds.length} grupos y ${base.triggers.length} disparos en modo local.` : existing ? "Se actualizaron la información, grupos o disparos." : "Se guardó una nueva automatización como borrador.";
      return { ...current, automations: existing ? current.automations.map((item) => item.id === id ? base : item) : [base, ...current.automations], eventLogs: [logFor(base, eventType, description), ...current.eventLogs] };
    });
    return id;
  }, [commit]);

  const duplicateAutomation = useCallback(async (id: string) => {
    const nextId = newId("automation");
    await commit((current) => {
      const source = current.automations.find((item) => item.id === id);
      if (!source) throw new Error("La automatización no existe.");
      if (source.lineId !== selectedLineIdRef.current) throw new Error("Cambia a la línea de la automatización antes de duplicarla.");
      const validGroupIds = source.groupIds.filter((groupId) => current.groups.some((group) => group.id === groupId && group.lineId === source.lineId));
      const now = new Date().toISOString();
      const duplicate: Automation = { ...source, id: nextId, groupIds: validGroupIds, name: `${source.name} (copia)`, status: "DRAFT", createdAt: now, updatedAt: now, activatedAt: undefined, finishedAt: undefined, resumeStatus: undefined, triggers: source.triggers.map((trigger) => ({ ...trigger, id: newId("trigger"), automationId: nextId, status: "PENDING", createdAt: now, updatedAt: now })) };
      return { ...current, automations: [duplicate, ...current.automations], eventLogs: [logFor(duplicate, "AUTOMATION_DUPLICATED", `Se duplicó a partir de “${source.name}”.`), ...current.eventLogs] };
    });
    return nextId;
  }, [commit]);

  const updateSelectedAutomation = useCallback(async (id: string, updater: (selected: Automation) => { automation: Automation; type: EventType; description: string }) => {
    await commit((current) => {
      const selected = current.automations.find((item) => item.id === id);
      if (!selected) throw new Error("La automatización no existe.");
      if (selected.lineId !== selectedLineIdRef.current) throw new Error("Cambia a la línea de la automatización antes de modificarla.");
      const result = updater(selected);
      return { ...current, automations: current.automations.map((item) => item.id === id ? result.automation : item), eventLogs: [logFor(result.automation, result.type, result.description), ...current.eventLogs] };
    });
  }, [commit]);

  const togglePause = useCallback(async (id: string) => updateSelectedAutomation(id, (selected) => {
    const pausing = selected.status === "ACTIVE" || selected.status === "SCHEDULED";
    const automation: Automation = { ...selected, status: pausing ? "PAUSED" : selected.resumeStatus ?? activationStatus(selected), resumeStatus: pausing ? (selected.status === "ACTIVE" ? "ACTIVE" : "SCHEDULED") : undefined, updatedAt: new Date().toISOString() };
    return { automation, type: pausing ? "AUTOMATION_PAUSED" : "AUTOMATION_RESUMED", description: pausing ? "Se pausó manualmente la automatización." : "Se reactivó la programación local." };
  }), [updateSelectedAutomation]);

  const cancelAutomation = useCallback(async (id: string) => updateSelectedAutomation(id, (selected) => ({
    automation: { ...selected, status: "CANCELLED", updatedAt: new Date().toISOString(), triggers: selected.triggers.map((trigger) => trigger.status === "PENDING" ? { ...trigger, status: "CANCELLED" } : trigger) },
    type: "AUTOMATION_CANCELLED",
    description: "Se canceló la automatización y sus disparos pendientes.",
  })), [updateSelectedAutomation]);

  const simulateTrigger = useCallback(async (automationId: string, triggerId: string, status: "SENT" | "FAILED") => updateSelectedAutomation(automationId, (selected) => {
    const now = new Date().toISOString();
    return {
      automation: { ...selected, updatedAt: now, triggers: selected.triggers.map((trigger) => trigger.id === triggerId ? { ...trigger, status, updatedAt: now } : trigger) },
      type: status === "SENT" ? "TRIGGER_SIMULATED_SENT" : "TRIGGER_SIMULATED_FAILED",
      description: `El disparo se marcó como ${status === "SENT" ? "enviado" : "fallido"} en la simulación local. No se envió ningún mensaje real.`,
    };
  }), [updateSelectedAutomation]);

  const selectedLine = useMemo(() => database?.lines.find((line) => line.id === selectedLineId) ?? null, [database, selectedLineId]);
  const value = useMemo<AppContextValue>(() => ({ database, selectedLineId, selectedLine, loading, saving, error, selectLine, createLine, renameLine, toggleLineActive, saveAutomation, duplicateAutomation, togglePause, cancelAutomation, simulateTrigger, refresh }), [database, selectedLineId, selectedLine, loading, saving, error, selectLine, createLine, renameLine, toggleLineActive, saveAutomation, duplicateAutomation, togglePause, cancelAutomation, simulateTrigger, refresh]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp debe utilizarse dentro de AppProvider.");
  return context;
}
