import Link from "next/link";
import { AUTOMATION_STATUSES, AUTOMATION_TYPES, TRIGGER_STATUSES } from "@/lib/domain/catalogs";
import type { AutomationStatus, AutomationType, TriggerStatus } from "@/lib/domain/types";

export function TypeBadge({ type }: { type: AutomationType }) { const item = AUTOMATION_TYPES[type]; return <span className={`badge ${item.className}`}>{item.label}</span>; }
export function StatusBadge({ status }: { status: AutomationStatus }) { const item = AUTOMATION_STATUSES[status]; return <span className={`status-badge ${item.className}`}><span className="status-dot" />{item.label}</span>; }
export function TriggerStatusBadge({ status }: { status: TriggerStatus }) { const item = TRIGGER_STATUSES[status]; return <span className={`status-badge ${item.className}`}><span className="status-dot" />{item.label}</span>; }
export function LinePill({ name }: { name: string }) { return <span className="line-pill"><span aria-hidden />Línea: <strong>{name}</strong></span>; }

export function PageHeader({ title, description, action = true }: { title: string; description?: string; action?: boolean }) {
  return <header className="page-header"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <Link className="button button-primary" href="/automatizaciones/nueva"><span aria-hidden>＋</span> Nueva automatización</Link>}</header>;
}
export function LoadingState() { return <div className="card empty-state" role="status"><div className="spinner" />Cargando información…</div>; }
export function EmptyState({ title, description }: { title: string; description: string }) { return <div className="card empty-state"><div className="empty-icon" aria-hidden>◇</div><strong>{title}</strong><p>{description}</p></div>; }
