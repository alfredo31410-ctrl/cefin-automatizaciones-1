"use client";

import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { LinePill, LoadingState, PageHeader, StatusBadge, TypeBadge } from "@/components/ui";
import { getNextTrigger } from "@/lib/domain/automation";
import { formatDateTime, isTodayInMexico } from "@/lib/domain/date";

export default function DashboardPage() {
  const { database, selectedLine, selectedLineId, loading } = useApp();
  if (loading || !database || !selectedLine) return <div className="page"><PageHeader title="Dashboard" description="Resumen por línea." /><LoadingState /></div>;
  const automations = database.automations.filter((item) => item.lineId === selectedLineId);
  const active = automations.filter((item) => item.status === "ACTIVE");
  const scheduled = automations.filter((item) => item.status === "SCHEDULED");
  const allTriggers = automations.flatMap((automation) => automation.triggers.map((trigger) => ({ ...trigger, automation })));
  const today = allTriggers.filter((item) => isTodayInMexico(item.scheduledAt));
  const errors = allTriggers.filter((item) => item.status === "FAILED").length + automations.filter((item) => item.status === "ERROR").length;
  const upcoming = allTriggers.filter((item) => item.status === "PENDING").sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt)).slice(0, 6);
  const visibleActive = automations.filter((item) => ["ACTIVE", "SCHEDULED", "PAUSED"].includes(item.status)).slice(0, 4);
  const kpis = [
    { label: "Automatizaciones activas", value: active.length, icon: "↗", tone: "purple" },
    { label: "Programadas", value: scheduled.length, icon: "◷", tone: "blue" },
    { label: "Disparos de hoy", value: today.length, icon: "✦", tone: "cyan" },
    { label: "Errores", value: errors, icon: "!", tone: "red" },
  ];

  return <div className="page">
    <PageHeader title="Dashboard" description={`Resumen operativo exclusivo de ${selectedLine.name}.`} />
    <LinePill name={selectedLine.name} />
    <section className="kpi-grid" aria-label={`Indicadores de ${selectedLine.name}`}>{kpis.map((item) => <article className="card kpi-card" key={item.label}><span className={`kpi-icon ${item.tone}`}>{item.icon}</span><div><p>{item.label}</p><strong>{item.value}</strong></div><small>{item.label === "Errores" ? "Requieren revisión" : `Datos locales de ${selectedLine.name}`}</small></article>)}</section>
    <div className="dashboard-grid">
      <section>
        <div className="section-heading"><div><h2>Automatizaciones en curso</h2><p>Secuencias de {selectedLine.name} activas, programadas o pausadas.</p></div><Link href="/automatizaciones">Ver todas →</Link></div>
        {visibleActive.length === 0 ? <div className="card empty-inline">No hay automatizaciones en curso para esta línea.</div> : <div className="automation-card-list">{visibleActive.map((automation) => { const next = getNextTrigger(automation); return <article className="card automation-card" key={automation.id}>
          <div className="automation-card-head"><div><TypeBadge type={automation.type} /><h3>{automation.name}</h3></div><StatusBadge status={automation.status} /></div>
          <div className="automation-stats"><span><small>Grupos</small><b>{automation.groupIds.length}</b></span><span><small>Disparos</small><b>{automation.triggers.length}</b></span><span><small>Próximo disparo</small><b>{formatDateTime(next?.scheduledAt)}</b></span></div>
          <Link className="card-link" href={`/automatizaciones/${automation.id}`}>Ver detalle <span>→</span></Link>
        </article>; })}</div>}
      </section>
      <section>
        <div className="section-heading"><div><h2>Próximos disparos</h2><p>Únicamente para {selectedLine.name}.</p></div></div>
        <div className="card upcoming-list">{upcoming.length === 0 ? <p className="muted">No hay disparos próximos.</p> : upcoming.map((item, index) => <Link href={`/automatizaciones/${item.automation.id}`} className="upcoming-row" key={item.id}><span className="timeline-marker">{index + 1}</span><span className="upcoming-copy"><strong>{item.automation.name}</strong><small>{item.content}</small></span><span className="upcoming-time"><b>{formatDateTime(item.scheduledAt)}</b><small>{item.automation.groupIds.length} grupos</small></span></Link>)}</div>
      </section>
    </div>
    <div className="simulation-notice"><span>ⓘ</span><div><strong>Estás trabajando en modo simulación</strong><p>Los estados y disparos de {selectedLine.name} son locales. No se envían mensajes reales a WhatsApp.</p></div></div>
  </div>;
}
