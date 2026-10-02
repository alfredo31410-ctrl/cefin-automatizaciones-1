"use client";

import { FormEvent, useState } from "react";
import { useApp } from "@/components/app-provider";
import { LoadingState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/domain/date";

export default function LinesPage() {
  const { database, selectedLineId, loading, saving, createLine, renameLine, toggleLineActive, selectLine } = useApp();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");

  if (loading || !database) return <div className="page"><PageHeader title="Líneas" action={false} /><LoadingState /></div>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const id = await createLine(name);
    setName("");
    await selectLine(id);
  }

  async function saveName(id: string) {
    await renameLine(id, editingName);
    setEditingId("");
    setEditingName("");
  }

  return <div className="page">
    <PageHeader title="Líneas" description="Administra las marcas y su disponibilidad dentro de la plataforma." action={false} />
    <section className="lines-layout">
      <form className="card line-create-card" onSubmit={(event) => void submit(event)}>
        <span className="eyebrow">Nueva línea</span>
        <h2>Agregar una marca</h2>
        <p>El slug se genera automáticamente y debe ser único.</p>
        <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. CEFIN México" required /></label>
        <button className="button button-primary" disabled={saving || !name.trim()}>Crear y seleccionar</button>
      </form>
      <section className="card lines-table-card" aria-label="Líneas registradas">
        <div className="lines-table-head"><div><span className="eyebrow">Administración</span><h2>{database.lines.length} líneas registradas</h2></div><p>Las líneas inactivas conservan todos sus datos.</p></div>
        <div className="lines-list">{database.lines.map((line) => {
          const isEditing = editingId === line.id;
          const automationCount = database.automations.filter((item) => item.lineId === line.id).length;
          const groupCount = database.groups.filter((item) => item.lineId === line.id).length;
          return <article className={`line-row ${selectedLineId === line.id ? "selected" : ""}`} key={line.id}>
            <div className="line-row-main"><span className="line-avatar">{line.name.slice(0, 2).toUpperCase()}</span><div>{isEditing ? <label className="inline-edit"><span className="sr-only">Nuevo nombre</span><input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} /></label> : <><strong>{line.name}</strong><small>/{line.slug} · creada {formatDate(line.createdAt)}</small></>}</div></div>
            <div className="line-counts"><span><b>{automationCount}</b> automatizaciones</span><span><b>{groupCount}</b> grupos</span></div>
            <span className={`status-badge ${line.active ? "status-green" : "status-neutral"}`}><span className="status-dot" />{line.active ? "Activa" : "Inactiva"}</span>
            <div className="line-actions">{isEditing ? <><button className="button button-primary button-small" onClick={() => void saveName(line.id)} disabled={saving || !editingName.trim()}>Guardar</button><button className="button button-secondary button-small" onClick={() => setEditingId("")}>Cancelar</button></> : <><button className="button button-secondary button-small" onClick={() => { setEditingId(line.id); setEditingName(line.name); }}>Editar</button>{line.active && selectedLineId !== line.id && <button className="button button-secondary button-small" onClick={() => void selectLine(line.id)}>Seleccionar</button>}<button className={`button button-small ${line.active ? "button-danger-soft" : "button-secondary"}`} onClick={() => void toggleLineActive(line.id)} disabled={saving}>{line.active ? "Desactivar" : "Reactivar"}</button></>}</div>
          </article>;
        })}</div>
      </section>
    </section>
    <div className="simulation-notice"><span>ⓘ</span><div><strong>Sin eliminación física</strong><p>Desactivar una línea la oculta del selector de trabajo, pero conserva grupos, automatizaciones e historial.</p></div></div>
  </div>;
}
