"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { completeLogout } from "@/lib/auth/logout";
import { AppProvider, useApp } from "./app-provider";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: "◦" },
  { href: "/automatizaciones", label: "Automatizaciones", icon: "⚡" },
  { href: "/grupos", label: "Grupos", icon: "◉" },
  { href: "/historial", label: "Historial", icon: "◷" },
  { href: "/lineas", label: "Líneas", icon: "◆", adminOnly: true },
];

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { database, user, isAdmin, selectedLineId, selectedLine, selectLine, saving, error, loading, clearAuthentication } = useApp();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function logout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await completeLogout({
        requestLogout: apiClient.logout,
        clearAuthentication,
        replace: router.replace,
      });
    } catch {
      setLogoutError("No fue posible cerrar la sesión. Intenta nuevamente.");
    } finally {
      setLoggingOut(false);
    }
  }

  const visibleNavigation = navigation.filter((item) => !item.adminOnly || isAdmin);
  const hasLines = (database?.lines.filter((line) => line.active).length ?? 0) > 0;

  return <div className="app-frame">
    <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Abrir navegación" aria-expanded={open}>☰</button>
    {open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Cerrar navegación" />}
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="brand"><span className="brand-mark">C</span><span><strong>CEFIN</strong><small>Automatizaciones</small></span></div>
      <label className="line-selector">
        <span>Línea de trabajo</span>
        <select aria-label="Línea de trabajo activa" value={selectedLineId} disabled={!database || saving || !hasLines} onChange={(event) => void selectLine(event.target.value)}>
          {database?.lines.filter((line) => line.active).map((line) => <option key={line.id} value={line.id}>{line.name}</option>)}
        </select>
        <small>Contexto actual: <strong>{selectedLine?.name ?? (loading ? "Cargando…" : "Sin acceso")}</strong></small>
      </label>
      <nav aria-label="Navegación principal">{visibleNavigation.map((item) => { const active = pathname === item.href || (item.href === "/automatizaciones" && pathname.startsWith("/automatizaciones")); return <Link key={item.href} href={item.href} className={active ? "active" : ""} onClick={() => setOpen(false)}><span aria-hidden>{item.icon}</span>{item.label}</Link>; })}</nav>
      <div className="sidebar-footer"><div className="user-row"><span className="avatar">{initials(user?.name ?? "Usuario")}</span><span><strong>{user?.name ?? "Usuario"}</strong><small>{user?.email ?? "Cargando…"}</small></span></div>{logoutError && <small className="form-error" role="alert">{logoutError}</small>}<button onClick={() => void logout()} disabled={loggingOut}><span aria-hidden>↪</span> {loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}</button><div className="mock-label"><span /> PostgreSQL · Sin envíos reales</div></div>
    </aside>
    <main className="main-content">{saving && <div className="save-indicator" role="status">Guardando…</div>}{error && <div className="global-error" role="alert">{error}</div>}{!loading && database && !hasLines ? <div className="page"><div className="card empty-state"><strong>Sin líneas disponibles</strong><p>Tu cuenta no tiene acceso a una línea activa. Solicita acceso a un administrador.</p></div></div> : children}</main>
  </div>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return <AppProvider><Shell>{children}</Shell></AppProvider>;
}
