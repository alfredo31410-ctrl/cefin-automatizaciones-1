"use client";

import Link from "next/link";
import { ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "./app-provider";
import { LoadingState, TypeBadge } from "./ui";
import { AUTOMATION_TYPES, APP_TIME_ZONE } from "@/lib/domain/catalogs";
import { dateTimeLocalToIso, formatDateTime, isoToDateTimeLocal } from "@/lib/domain/date";
import { getDuplicateSchedules, sortTriggers, validateAutomation } from "@/lib/domain/automation";
import type { Automation, AutomationInput, AutomationType, Group } from "@/lib/domain/types";

function blankTrigger(): AutomationInput["triggers"][number] {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(10, 0, 0, 0);
  return { id: `draft-${crypto.randomUUID()}`, content: "", scheduledAt: dateTimeLocalToIso(isoToDateTimeLocal(tomorrow.toISOString())) };
}

function initialInput(automation?: Automation): AutomationInput {
  return automation ? { name: automation.name, type: automation.type, groupIds: automation.groupIds, triggers: automation.triggers.map(({ id, content, scheduledAt, attachment }) => ({ id, content, scheduledAt, attachment })) } : { name: "", type: "VENTA", groupIds: [], triggers: [blankTrigger()] };
}

export function AutomationForm({ automationId }: { automationId?: string }) {
  const router = useRouter();
  const { database, loading, saving, saveAutomation } = useApp();
  const automation = database?.automations.find((item) => item.id === automationId);
  if (loading || !database) return <LoadingState />;
  if (automationId && !automation) return <div className="card empty-state"><strong>Automatización no encontrada</strong><Link className="button button-secondary" href="/automatizaciones">Volver al listado</Link></div>;
  return <AutomationFormReady key={automation?.updatedAt ?? "new"} automation={automation} groups={database.groups} saving={saving} saveAutomation={saveAutomation} onDone={(id) => router.push(`/automatizaciones/${id}`)} />;
}

function AutomationFormReady({ automation, groups, saving, saveAutomation, onDone }: { automation?: Automation; groups: Group[]; saving: boolean; saveAutomation: ReturnType<typeof useApp>["saveAutomation"]; onDone: (id: string) => void }) {
  const [input, setInput] = useState(() => initialInput(automation));
  const [groupSearch, setGroupSearch] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const activeGroups = groups.filter((group) => group.active);
  const filteredGroups = activeGroups.filter((group) => group.name.toLowerCase().includes(groupSearch.toLowerCase()));
  const orderedTriggers = useMemo(() => sortTriggers(input.triggers), [input.triggers]);
  const duplicates = getDuplicateSchedules(input);
  const first = orderedTriggers[0]?.scheduledAt;
  const last = orderedTriggers.at(-1)?.scheduledAt;

  function toggleGroup(id: string) { setInput((current) => ({ ...current, groupIds: current.groupIds.includes(id) ? current.groupIds.filter((item) => item !== id) : [...current.groupIds, id] })); }
  function updateTrigger(id: string, patch: Partial<AutomationInput["triggers"][number]>) { setInput((current) => ({ ...current, triggers: current.triggers.map((item) => item.id === id ? { ...item, ...patch } : item) })); }
  function removeTrigger(id: string) { setInput((current) => ({ ...current, triggers: current.triggers.filter((item) => item.id !== id) })); }
  function attachmentChanged(id: string, event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; updateTrigger(id, { attachment: file ? { name: file.name, type: file.type, size: file.size } : undefined }); }

  async function saveDraft() {
    if (!input.name.trim()) { setErrors(["Escribe un nombre para guardar el borrador."]); return; }
    const id = await saveAutomation({ ...input, triggers: orderedTriggers }, { id: automation?.id }); onDone(id);
  }
  function review() { const nextErrors = validateAutomation(input); setErrors(nextErrors); if (nextErrors.length === 0) setReviewOpen(true); }
  async function activate() { const id = await saveAutomation({ ...input, triggers: orderedTriggers }, { id: automation?.id, activate: true }); setReviewOpen(false); onDone(id); }

  return <>
    <div className="form-layout">
      <div className="form-main">
        <section className="card form-section"><div className="section-number">1</div><div className="form-section-content"><div className="section-title"><h2>Información</h2><p>Identifica esta secuencia y su objetivo.</p></div><label>Nombre de la automatización<input value={input.name} onChange={(event) => setInput({ ...input, name: event.target.value })} placeholder="Ej. Master IA Octubre — Venta" /></label><fieldset><legend>Etiqueta</legend><div className="type-options">{(Object.keys(AUTOMATION_TYPES) as AutomationType[]).map((type) => <label key={type} className={input.type === type ? "selected" : ""}><input type="radio" name="type" value={type} checked={input.type === type} onChange={() => setInput({ ...input, type })} /><TypeBadge type={type} /><small>{type === "PREVENTA" ? "Anticipación" : type === "VENTA" ? "Conversión" : type === "RETARGETING" ? "Seguimiento" : "Nutrición"}</small></label>)}</div></fieldset></div></section>

        <section className="card form-section"><div className="section-number">2</div><div className="form-section-content"><div className="section-title"><h2>Grupos</h2><p>Selecciona los grupos que recibirían esta secuencia.</p></div><div className="group-tools"><label className="search-field"><span aria-hidden>⌕</span><span className="sr-only">Buscar grupos</span><input value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} placeholder="Buscar grupos…" /></label><span>{input.groupIds.length} grupo{input.groupIds.length === 1 ? "" : "s"} seleccionado{input.groupIds.length === 1 ? "" : "s"}</span></div><div className="select-links"><button type="button" onClick={() => setInput({ ...input, groupIds: activeGroups.map((group) => group.id) })}>Seleccionar todos</button><button type="button" onClick={() => setInput({ ...input, groupIds: [] })}>Deseleccionar todos</button></div><div className="group-selector">{filteredGroups.map((group) => <label key={group.id} className={input.groupIds.includes(group.id) ? "checked" : ""}><input type="checkbox" checked={input.groupIds.includes(group.id)} onChange={() => toggleGroup(group.id)} /><span><strong>{group.name}</strong><small>{group.memberCount?.toLocaleString("es-MX")} miembros</small></span></label>)}</div></div></section>

        <section className="card form-section"><div className="section-number">3</div><div className="form-section-content"><div className="section-title title-row"><div><h2>Disparos</h2><p>Agrega los mensajes y define su fecha exacta.</p></div><button type="button" className="button button-secondary" onClick={() => setInput({ ...input, triggers: [...input.triggers, blankTrigger()] })}>＋ Agregar disparo</button></div><div className="timezone-note">Zona horaria: <strong>{APP_TIME_ZONE} (UTC−6)</strong></div>{duplicates.length > 0 && <div className="warning" role="alert">⚠ Hay disparos con la misma fecha y hora. Revisa la programación antes de activar.</div>}<div className="trigger-editor-list">{input.triggers.map((trigger, index) => <article className="trigger-editor" key={trigger.id}><div className="trigger-editor-head"><span>Disparo #{index + 1}</span><button type="button" onClick={() => removeTrigger(trigger.id)} aria-label={`Eliminar disparo ${index + 1}`}>Eliminar</button></div><div className="trigger-fields"><label>Fecha y hora<input type="datetime-local" value={isoToDateTimeLocal(trigger.scheduledAt)} onChange={(event) => updateTrigger(trigger.id, { scheduledAt: dateTimeLocalToIso(event.target.value) })} /></label><label className="message-field">Mensaje<textarea rows={4} value={trigger.content} onChange={(event) => updateTrigger(trigger.id, { content: event.target.value })} placeholder="Escribe el mensaje que se enviaría a los grupos…" /></label><label className="attachment-field">Adjunto opcional <span><input type="file" onChange={(event) => attachmentChanged(trigger.id, event)} /><b>{trigger.attachment?.name ?? "Seleccionar archivo (solo metadata)"}</b></span></label></div></article>)}</div></div></section>
      </div>

      <aside className="card review-sidebar"><span className="eyebrow">4 · Revisión</span><h2>Resumen</h2><dl><div><dt>Nombre</dt><dd>{input.name || "Sin nombre"}</dd></div><div><dt>Etiqueta</dt><dd><TypeBadge type={input.type} /></dd></div><div><dt>Grupos</dt><dd>{input.groupIds.length}</dd></div><div><dt>Disparos</dt><dd>{input.triggers.length}</dd></div><div><dt>Primer envío</dt><dd>{formatDateTime(first)}</dd></div><div><dt>Último envío</dt><dd>{formatDateTime(last)}</dd></div></dl>{errors.length > 0 && <div className="validation-errors" role="alert"><strong>Revisa lo siguiente:</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}<button className="button button-secondary button-wide" onClick={() => void saveDraft()} disabled={saving}>Guardar borrador</button><button className="button button-primary button-wide" onClick={review} disabled={saving}>Revisar y activar</button><p className="no-send-inline">ⓘ Activar sólo cambia el estado local.</p></aside>
    </div>

    {reviewOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewOpen(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><div className="modal-icon">✓</div><h2 id="confirm-title">Confirmar automatización</h2><p>Verifica los datos antes de activar la programación local.</p><dl><div><dt>Nombre</dt><dd>{input.name}</dd></div><div><dt>Etiqueta</dt><dd>{AUTOMATION_TYPES[input.type].label}</dd></div><div><dt>Alcance</dt><dd>{input.groupIds.length} grupos · {input.triggers.length} disparos</dd></div><div><dt>Primer envío</dt><dd>{formatDateTime(first)}</dd></div><div><dt>Último envío</dt><dd>{formatDateTime(last)}</dd></div></dl><div className="warning">Una vez activa, los disparos comenzarán a ejecutarse según la programación. En este MVP sólo se simulan estados.</div><div className="modal-actions"><button className="button button-secondary" onClick={() => setReviewOpen(false)}>Cancelar</button><button className="button button-primary" onClick={() => void activate()} disabled={saving}>Activar automatización</button></div></section></div>}
  </>;
}
