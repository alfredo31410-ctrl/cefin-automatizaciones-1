"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/auth/demo-auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    setLoading(false);
    if (!response.ok) { const body = (await response.json()) as { error?: string }; setError(body.error ?? "No fue posible iniciar sesión."); return; }
    router.push("/dashboard"); router.refresh();
  }

  return <main className="login-page">
    <section className="login-panel" aria-labelledby="login-title">
      <div className="login-brand"><span className="brand-mark">C</span><span><strong>CEFIN</strong><small>Automatizaciones</small></span></div>
      <div className="login-heading"><span className="eyebrow">Acceso interno</span><h1 id="login-title">Bienvenido de nuevo</h1><p>Administra las secuencias programadas para tus grupos de WhatsApp.</p></div>
      <form onSubmit={submit}>
        <label htmlFor="email">Correo electrónico</label><input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label htmlFor="password">Contraseña</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary button-wide" disabled={loading}>{loading ? "Ingresando…" : "Iniciar sesión"}</button>
      </form>
      <div className="demo-credentials"><strong>Credenciales demo</strong><span>{DEMO_EMAIL}</span><span>Contraseña: {DEMO_PASSWORD}</span></div>
      <p className="security-note">Autenticación exclusiva del MVP local. No es válida para producción.</p>
    </section>
    <aside className="login-aside" aria-label="Información del producto">
      <div><span className="aside-pill">MVP local</span><h2>Tu operación de mensajes, clara y en control.</h2><p>Diseña, programa y revisa automatizaciones desde un solo lugar.</p></div>
      <div className="aside-preview"><div className="preview-top"><span>Próximos disparos</span><small>Esta semana</small></div>{["Master IA — Venta", "Contabilidad Electrónica", "Estratega Fiscal"].map((item, index) => <div className="preview-row" key={item}><span className={`preview-icon preview-${index}`}>↗</span><span><strong>{item}</strong><small>{index + 2} grupos · {10 + index * 3}:00</small></span><b>{index === 0 ? "Hoy" : `Día ${index + 2}`}</b></div>)}</div>
      <div className="no-send"><span>✓</span><p><strong>Entorno seguro de simulación</strong><br />Este MVP no realiza envíos reales de WhatsApp.</p></div>
    </aside>
  </main>;
}
