"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AppProvider, useApp } from "./app-provider";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/automatizaciones", label: "Automatizaciones", icon: "⚡" },
  { href: "/grupos", label: "Grupos", icon: "◉" },
  { href: "/historial", label: "Historial", icon: "◷" },
];

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const { saving, error } = useApp(); const [open, setOpen] = useState(false);
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }
  return <div className="app-frame">
    <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Abrir navegación" aria-expanded={open}>☰</button>
    {open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Cerrar navegación" />}
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="brand"><span className="brand-mark">C</span><span><strong>CEFIN</strong><small>Automatizaciones</small></span></div>
      <nav aria-label="Navegación principal">{navigation.map((item) => { const active = pathname === item.href || (item.href === "/automatizaciones" && pathname.startsWith("/automatizaciones")); return <Link key={item.href} href={item.href} className={active ? "active" : ""} onClick={() => setOpen(false)}><span aria-hidden>{item.icon}</span>{item.label}</Link>; })}</nav>
      <div className="sidebar-footer"><div className="user-row"><span className="avatar">AC</span><span><strong>Administrador</strong><small>admin@cefin.com.mx</small></span></div><button onClick={logout}><span aria-hidden>↪</span> Cerrar sesión</button><div className="mock-label"><span /> Modo local · Sin envíos reales</div></div>
    </aside>
    <main className="main-content">{saving && <div className="save-indicator" role="status">Guardando…</div>}{error && <div className="global-error" role="alert">{error}</div>}{children}</main>
  </div>;
}
export function AppShell({ children }: { children: React.ReactNode }) { return <AppProvider><Shell>{children}</Shell></AppProvider>; }
