"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app-provider";
import { LinePill, LoadingState, PageHeader } from "@/components/ui";
import { EVENT_LABELS } from "@/lib/domain/catalogs";
import { formatDateTime } from "@/lib/domain/date";
import type { EventType } from "@/lib/domain/types";

export default function HistoryPage() {
  const { database, selectedLine, selectedLineId, loading } = useApp();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<EventType | "">("");
  const logs = useMemo(() => (database?.eventLogs ?? []).filter((log) => log.lineId === selectedLineId && (!type || log.type === type) && `${log.automationName} ${log.description}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [database, selectedLineId, search, type]);
  if (loading || !database || !selectedLine) return <div className="page"><PageHeader title="Historial" action={false} /><LoadingState /></div>;
  return <div className="page"><PageHeader title="Historial" description={`Actividad y simulaciones de ${selectedLine.name}.`} action={false} />
    <LinePill name={selectedLine.name} />
    <section className="card filters"><label className="search-field"><span aria-hidden>⌕</span><span className="sr-only">Buscar en historial</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar automatización o evento…" /></label><label><span className="sr-only">Filtrar tipo de evento</span><select value={type} onChange={(event) => setType(event.target.value as EventType | "")}><option value="">Todos los eventos</option>{Object.entries(EVENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><span className="result-count">{logs.length} eventos</span></section>
    {logs.length === 0 ? <div className="card empty-inline">No hay eventos para {selectedLine.name}.</div> : <div className="card history-list"><div className="history-head"><span>Fecha y hora</span><span>Automatización</span><span>Evento</span><span>Descripción</span></div>{logs.map((log) => <div className="history-row" key={log.id}><time>{formatDateTime(log.createdAt, "long")}</time>{log.automationId ? <Link href={`/automatizaciones/${log.automationId}`}>{log.automationName}</Link> : <span>{log.automationName}</span>}<span className="event-label">{EVENT_LABELS[log.type] ?? log.type.replaceAll("_", " ")}</span><p>{log.description}</p></div>)}</div>}
  </div>;
}
