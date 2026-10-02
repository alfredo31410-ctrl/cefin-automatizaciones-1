"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/app-provider";
import { LinePill, LoadingState, StatusBadge, TriggerStatusBadge, TypeBadge } from "@/components/ui";
import { getNextTrigger, sortTriggers } from "@/lib/domain/automation";
import { formatDateTime } from "@/lib/domain/date";

export default function AutomationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { database, selectedLine, selectedLineId, loading, saving, selectLine, duplicateAutomation, togglePause, cancelAutomation, simulateTrigger } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  if (loading || !database || !selectedLine) return <div className="page"><LoadingState /></div>;
  const automation = database.automations.find((item) => item.id === id);
  if (!automation) return <div className="page"><div className="card empty-state"><strong>Automatización no encontrada</strong><Link className="button button-secondary" href="/automatizaciones">Volver al listado</Link></div></div>;
  const owner = database.lines.find((line) => line.id === automation.lineId);
  if (automation.lineId !== selectedLineId) return <div className="page"><div className="card line-mismatch"><span className="empty-icon" aria-hidden>↔</span><div><strong>Esta automatización pertenece a {owner?.name ?? "otra línea"}.</strong><p>El contexto activo es {selectedLine.name}. No mostramos datos de otra línea dentro del contexto actual.</p></div>{owner?.active ? <button className="button button-primary" onClick={() => void selectLine(owner.id)}>Cambiar a {owner.name}</button> : <Link className="button button-secondary" href="/lineas">La línea está inactiva</Link>}</div></div>;

  const groups = automation.groupIds.map((groupId) => database.groups.find((group) => group.id === groupId && group.lineId === automation.lineId)).filter(Boolean);
  const triggers = sortTriggers(automation.triggers);
  const next = getNextTrigger(automation);
  const first = triggers[0];
  const last = triggers.at(-1);
  const canToggle = ["ACTIVE", "SCHEDULED", "PAUSED"].includes(automation.status);
  const canCancel = !["COMPLETED", "CANCELLED"].includes(automation.status);
  async function duplicate() { const nextId = await duplicateAutomation(id); router.push(`/automatizaciones/${nextId}`); }
  async function cancel() { if (window.confirm("¿Cancelar esta automatización y sus disparos pendientes?")) await cancelAutomation(id); }

  return <div className="page">
    <header className="detail-header"><div><Link className="back-link" href="/automatizaciones">← Volver a automatizaciones</Link><div className="detail-title"><h1>{automation.name}</h1><TypeBadge type={automation.type} /><StatusBadge status={automation.status} /></div><p>Actualizada {formatDateTime(automation.updatedAt, "long")}</p><LinePill name={selectedLine.name} /></div><div className="detail-actions"><Link className="button button-secondary" href={`/automatizaciones/${id}/editar`}>Editar</Link><button className="button button-secondary" onClick={() => void duplicate()} disabled={saving}>Duplicar</button>{canToggle && <button className="button button-primary" onClick={() => void togglePause(id)} disabled={saving}>{automation.status === "PAUSED" ? "Reactivar" : "Pausar"}</button>}<div className="more-menu"><button className="button button-icon" aria-label="Más acciones" onClick={() => setMenuOpen(!menuOpen)}>•••</button>{menuOpen && <div>{canCancel ? <button onClick={() => void cancel()}>Cancelar automatización</button> : <span>Sin acciones adicionales</span>}</div>}</div></div></header>
    <section className="summary-grid"><article className="card"><small>Grupos</small><strong>{groups.length}</strong><span>incluidos</span></article><article className="card"><small>Disparos</small><strong>{triggers.length}</strong><span>programados</span></article><article className="card"><small>Inicio</small><strong>{formatDateTime(first?.scheduledAt)}</strong><span>primer disparo</span></article><article className="card"><small>Último disparo</small><strong>{formatDateTime(last?.scheduledAt)}</strong><span>fin de secuencia</span></article><article className="card highlight"><small>Próximo disparo</small><strong>{formatDateTime(next?.scheduledAt)}</strong><span>{next ? "pendiente" : "sin pendientes"}</span></article></section>
    <div className="detail-grid"><section><div className="section-heading"><div><h2>Grupos incluidos</h2><p>{groups.length} destinos de {selectedLine.name}.</p></div></div><div className="card included-groups">{groups.map((group) => group && <div key={group.id}><span className="group-avatar">{group.name.split(" ").slice(0, 2).map((word) => word[0]).join("")}</span><span><strong>{group.name}</strong><small>{group.memberCount?.toLocaleString("es-MX")} miembros</small></span><span className="status-badge status-green"><span className="status-dot" />Activo</span></div>)}</div></section>
      <section><div className="section-heading"><div><h2>Timeline de disparos</h2><p>Seguimiento local de la secuencia.</p></div></div><div className="card trigger-timeline">{triggers.map((trigger, index) => <article key={trigger.id}><div className="timeline-line"><span>{index + 1}</span></div><div className="timeline-content"><div className="timeline-head"><div><strong>Disparo #{index + 1}</strong><time>{formatDateTime(trigger.scheduledAt, "long")}</time></div><TriggerStatusBadge status={trigger.status} /></div><blockquote>“{trigger.content}”</blockquote>{trigger.attachment && <span className="attachment">📎 {trigger.attachment.name}</span>}{trigger.status === "PENDING" && <div className="simulate-actions"><span>Simular resultado:</span><button onClick={() => void simulateTrigger(id, trigger.id, "SENT")}>Marcar enviado</button><button className="danger-text" onClick={() => void simulateTrigger(id, trigger.id, "FAILED")}>Marcar fallido</button></div>}</div></article>)}</div></section>
    </div>
    <div className="simulation-notice"><span>ⓘ</span><div><strong>Simulación local activa</strong><p>Ninguna acción programa o envía mensajes en Funnelchat o WhatsApp.</p></div></div>
  </div>;
}
