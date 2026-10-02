"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { AppDatabase, Automation, AutomationInput, AutomationStatus, EventLog, EventType, TriggerStatus } from "@/lib/domain/types";
import { sortTriggers } from "@/lib/domain/automation";

interface AppContextValue {
  database: AppDatabase | null;
  loading: boolean;
  saving: boolean;
  error: string;
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
  return { id: newId("log"), automationId: automation.id, automationName: automation.name, type, description, createdAt: new Date().toISOString() };
}

function activationStatus(automation: Pick<Automation, "triggers">): AutomationStatus {
  const first = sortTriggers(automation.triggers)[0];
  return first && new Date(first.scheduledAt).getTime() > Date.now() ? "SCHEDULED" : "ACTIVE";
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [database, setDatabase] = useState<AppDatabase | null>(null);
  const databaseRef = useRef<AppDatabase | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) throw new Error("No fue posible cargar los datos locales.");
      const next = (await response.json()) as AppDatabase;
      databaseRef.current = next; setDatabase(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ocurrió un error inesperado.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/state", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("No fue posible cargar los datos locales.");
        return response.json() as Promise<AppDatabase>;
      })
      .then((next) => {
        if (!active) return;
        databaseRef.current = next;
        setDatabase(next);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Ocurrió un error inesperado.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const commit = useCallback(async (updater: (current: AppDatabase) => AppDatabase) => {
    if (!databaseRef.current) throw new Error("Los datos aún no están disponibles.");
    const previous = databaseRef.current;
    const optimistic = updater(previous);
    databaseRef.current = optimistic; setDatabase(optimistic); setSaving(true); setError("");
    try {
      const response = await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(optimistic) });
      if (!response.ok) throw new Error("No fue posible guardar los cambios.");
      const saved = (await response.json()) as AppDatabase;
      databaseRef.current = saved; setDatabase(saved);
    } catch (caught) {
      databaseRef.current = previous; setDatabase(previous);
      setError(caught instanceof Error ? caught.message : "No fue posible guardar los cambios.");
      throw caught;
    } finally { setSaving(false); }
  }, []);

  const saveAutomation = useCallback(async (input: AutomationInput, options?: { id?: string; activate?: boolean }) => {
    const id = options?.id ?? newId("automation");
    await commit((current) => {
      const existing = current.automations.find((item) => item.id === id);
      const now = new Date().toISOString();
      const triggers = sortTriggers(input.triggers.map((trigger) => {
        const previous = existing?.triggers.find((item) => item.id === trigger.id);
        return { ...trigger, id: trigger.id || newId("trigger"), automationId: id, status: previous?.status ?? "PENDING" as TriggerStatus, createdAt: previous?.createdAt ?? now, updatedAt: now };
      }));
      const base: Automation = { id, name: input.name.trim(), type: input.type, groupIds: [...new Set(input.groupIds)], triggers, status: existing?.status ?? "DRAFT", createdAt: existing?.createdAt ?? now, updatedAt: now, activatedAt: existing?.activatedAt, finishedAt: existing?.finishedAt, resumeStatus: existing?.resumeStatus };
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
      if (!source) return current;
      const now = new Date().toISOString();
      const duplicate: Automation = { ...source, id: nextId, name: `${source.name} (copia)`, status: "DRAFT", createdAt: now, updatedAt: now, activatedAt: undefined, finishedAt: undefined, resumeStatus: undefined, triggers: source.triggers.map((trigger) => ({ ...trigger, id: newId("trigger"), automationId: nextId, status: "PENDING", createdAt: now, updatedAt: now })) };
      return { ...current, automations: [duplicate, ...current.automations], eventLogs: [logFor(duplicate, "AUTOMATION_DUPLICATED", `Se duplicó a partir de “${source.name}”.`), ...current.eventLogs] };
    });
    return nextId;
  }, [commit]);

  const togglePause = useCallback(async (id: string) => {
    await commit((current) => {
      const selected = current.automations.find((item) => item.id === id);
      if (!selected) return current;
      const pausing = selected.status === "ACTIVE" || selected.status === "SCHEDULED";
      const next: Automation = { ...selected, status: pausing ? "PAUSED" : selected.resumeStatus ?? activationStatus(selected), resumeStatus: pausing ? (selected.status === "ACTIVE" ? "ACTIVE" : "SCHEDULED") : undefined, updatedAt: new Date().toISOString() };
      return { ...current, automations: current.automations.map((item) => item.id === id ? next : item), eventLogs: [logFor(next, pausing ? "AUTOMATION_PAUSED" : "AUTOMATION_RESUMED", pausing ? "Se pausó manualmente la automatización." : "Se reactivó la programación local."), ...current.eventLogs] };
    });
  }, [commit]);

  const cancelAutomation = useCallback(async (id: string) => {
    await commit((current) => {
      const selected = current.automations.find((item) => item.id === id);
      if (!selected) return current;
      const next: Automation = { ...selected, status: "CANCELLED", updatedAt: new Date().toISOString(), triggers: selected.triggers.map((trigger) => trigger.status === "PENDING" ? { ...trigger, status: "CANCELLED" } : trigger) };
      return { ...current, automations: current.automations.map((item) => item.id === id ? next : item), eventLogs: [logFor(next, "AUTOMATION_CANCELLED", "Se canceló la automatización y sus disparos pendientes."), ...current.eventLogs] };
    });
  }, [commit]);

  const simulateTrigger = useCallback(async (automationId: string, triggerId: string, status: "SENT" | "FAILED") => {
    await commit((current) => {
      const selected = current.automations.find((item) => item.id === automationId);
      if (!selected) return current;
      const now = new Date().toISOString();
      const next: Automation = { ...selected, updatedAt: now, triggers: selected.triggers.map((trigger) => trigger.id === triggerId ? { ...trigger, status, updatedAt: now } : trigger) };
      return { ...current, automations: current.automations.map((item) => item.id === automationId ? next : item), eventLogs: [logFor(next, status === "SENT" ? "TRIGGER_SIMULATED_SENT" : "TRIGGER_SIMULATED_FAILED", `El disparo se marcó como ${status === "SENT" ? "enviado" : "fallido"} en la simulación local. No se envió ningún mensaje real.`), ...current.eventLogs] };
    });
  }, [commit]);

  return <AppContext.Provider value={{ database, loading, saving, error, saveAutomation, duplicateAutomation, togglePause, cancelAutomation, simulateTrigger, refresh }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp debe utilizarse dentro de AppProvider.");
  return context;
}
