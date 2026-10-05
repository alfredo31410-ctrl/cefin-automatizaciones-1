"use client";

import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { LinePill, LoadingState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/domain/date";

export default function GroupsPage() {
  const { database, selectedLine, selectedLineId, loading } = useApp();
  const [search, setSearch] = useState("");
  if (loading || !database || !selectedLine) return <div className="page"><PageHeader title="Grupos" /><LoadingState /></div>;
  const lineGroups = database.groups.filter((group) => group.lineId === selectedLineId);
  const groups = lineGroups.filter((group) => group.name.toLowerCase().includes(search.toLowerCase()));
  return <div className="page"><PageHeader title="Grupos" description={`Directorio exclusivo de ${selectedLine.name}.`} action={false} />
    <LinePill name={selectedLine.name} />
    <div className="card groups-summary"><div><span className="kpi-icon blue">◉</span><p><strong>{lineGroups.length}</strong> grupos en {selectedLine.name}</p></div><p>Origen actual: <b>PostgreSQL</b></p></div>
    <section className="card filters"><label className="search-field"><span aria-hidden>⌕</span><span className="sr-only">Buscar grupo</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar grupo…" /></label><span className="result-count">{groups.length} resultado{groups.length === 1 ? "" : "s"}</span></section>
    {groups.length === 0 ? <div className="card empty-inline">No hay grupos que coincidan en {selectedLine.name}.</div> : <div className="group-grid">{groups.map((group) => <article className="card group-card" key={group.id}><div className="group-card-head"><span className="group-avatar">{group.name.split(" ").slice(0, 2).map((word) => word[0]).join("")}</span><span className={`status-badge ${group.active ? "status-green" : "status-neutral"}`}><span className="status-dot" />{group.active ? "Activo" : "Inactivo"}</span></div><h2>{group.name}</h2><dl><div><dt>Miembros</dt><dd>{group.memberCount?.toLocaleString("es-MX") ?? "—"}</dd></div><div><dt>Identificador externo</dt><dd>{group.externalId ?? "Pendiente"}</dd></div><div><dt>Agregado</dt><dd>{formatDate(group.createdAt)}</dd></div></dl></article>)}</div>}
    <div className="simulation-notice"><span>ⓘ</span><div><strong>Directorio persistido</strong><p>El origen está aislado por línea. No existe integración activa con Funnelchat ni WhatsApp.</p></div></div>
  </div>;
}
