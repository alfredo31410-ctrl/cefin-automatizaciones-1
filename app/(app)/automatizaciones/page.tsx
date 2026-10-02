"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/app-provider";
import { EmptyState, LinePill, LoadingState, PageHeader, StatusBadge, TypeBadge } from "@/components/ui";
import { getNextTrigger } from "@/lib/domain/automation";
import { AUTOMATION_STATUSES, AUTOMATION_TYPES } from "@/lib/domain/catalogs";
import { formatDateTime } from "@/lib/domain/date";
import type { AutomationStatus, AutomationType } from "@/lib/domain/types";

export default function AutomationsPage() {
  const router = useRouter();
  const { database, selectedLine, selectedLineId, loading, duplicateAutomation, togglePause } = useApp();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<AutomationType | "">("");
  const [status, setStatus] = useState<AutomationStatus | "">("");
  const filtered = useMemo(() => (database?.automations ?? []).filter((item) => item.lineId === selectedLineId && item.name.toLowerCase().includes(search.toLowerCase()) && (!type || item.type === type) && (!status || item.status === status)), [database, selectedLineId, search, type, status]);
  async function duplicate(id: string) { const nextId = await duplicateAutomation(id); router.push(`/automatizaciones/${nextId}`); }
  if (loading || !database || !selectedLine) return <div className="page"><PageHeader title="Automatizaciones" /><LoadingState /></div>;
  return <div className="page">
    <PageHeader title="Automatizaciones" description={`Secuencias pertenecientes a ${selectedLine.name}.`} />
    <LinePill name={selectedLine.name} />
    <section className="card filters" aria-label="Filtros"><label className="search-field"><span aria-hidden>⌕</span><span className="sr-only">Buscar por nombre</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar automatización…" /></label><label><span className="sr-only">Filtrar por etiqueta</span><select value={type} onChange={(event) => setType(event.target.value as AutomationType | "")}><option value="">Todas las etiquetas</option>{Object.entries(AUTOMATION_TYPES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label><label><span className="sr-only">Filtrar por estado</span><select value={status} onChange={(event) => setStatus(event.target.value as AutomationStatus | "")}><option value="">Todos los estados</option>{Object.entries(AUTOMATION_STATUSES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label><span className="result-count">{filtered.length} resultado{filtered.length === 1 ? "" : "s"}</span></section>
    {filtered.length === 0 ? <EmptyState title={`Sin automatizaciones en ${selectedLine.name}`} description="Prueba con otros filtros o crea una automatización para esta línea." /> : <div className="card table-card"><div className="table-scroll"><table><thead><tr><th>Nombre</th><th>Etiqueta</th><th>Estado</th><th>Grupos</th><th>Disparos</th><th>Próximo envío</th><th>Actualización</th><th>Acciones</th></tr></thead><tbody>{filtered.map((automation) => { const next = getNextTrigger(automation); const canToggle = ["ACTIVE", "SCHEDULED", "PAUSED"].includes(automation.status); return <tr key={automation.id}><td><Link className="table-name" href={`/automatizaciones/${automation.id}`}>{automation.name}</Link></td><td><TypeBadge type={automation.type} /></td><td><StatusBadge status={automation.status} /></td><td>{automation.groupIds.length}</td><td>{automation.triggers.length}</td><td>{formatDateTime(next?.scheduledAt)}</td><td>{formatDateTime(automation.updatedAt)}</td><td><div className="table-actions"><Link href={`/automatizaciones/${automation.id}`}>Ver</Link><Link href={`/automatizaciones/${automation.id}/editar`}>Editar</Link><button onClick={() => void duplicate(automation.id)}>Duplicar</button>{canToggle && <button onClick={() => void togglePause(automation.id)}>{automation.status === "PAUSED" ? "Reactivar" : "Pausar"}</button>}</div></td></tr>; })}</tbody></table></div></div>}
  </div>;
}
