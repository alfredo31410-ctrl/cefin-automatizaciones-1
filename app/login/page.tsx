"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api/client";

function initialMessage(reason: string | null): string {
  if (reason === "session") return "Tu sesión terminó. Inicia sesión nuevamente.";
  if (reason === "api") return "La API no está disponible en este momento.";
  return "";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() => initialMessage(searchParams.get("reason")));
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiClient.login(email, password);
      setSuccess(true);
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No fue posible iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="login-page">
    <section className="login-panel" aria-labelledby="login-title">
      <div className="login-brand"><span className="brand-mark">C</span><span><strong>CEFIN</strong><small>Automatizaciones</small></span></div>
      <div className="login-heading"><span className="eyebrow">Acceso interno</span><h1 id="login-title">Bienvenido de nuevo</h1><p>Ingresa con las credenciales asignadas por un administrador.</p></div>
      <form onSubmit={submit}>
        <label htmlFor="email">Correo electrónico</label><input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus />
        <label htmlFor="password">Contraseña</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary button-wide" disabled={loading || success}>{success ? "Acceso correcto…" : loading ? "Ingresando…" : "Iniciar sesión"}</button>
      </form>
      <p className="security-note">Sesión protegida con cookie HttpOnly. La contraseña no se almacena en el navegador.</p>
    </section>
    <aside className="login-aside" aria-label="Información del producto">
      <div><span className="aside-pill">V2.1B</span><h2>Tu operación de mensajes, clara y en control.</h2><p>Diseña, programa y revisa automatizaciones desde un solo lugar.</p></div>
      <div className="aside-preview"><div className="preview-top"><span>Próximos disparos</span><small>Esta semana</small></div>{["Master IA — Venta", "Contabilidad Electrónica", "Estratega Fiscal"].map((item, index) => <div className="preview-row" key={item}><span className={`preview-icon preview-${index}`}>↗</span><span><strong>{item}</strong><small>{index + 2} grupos · {10 + index * 3}:00</small></span><b>{index === 0 ? "Hoy" : `Día ${index + 2}`}</b></div>)}</div>
      <div className="no-send"><span>✓</span><p><strong>Entorno seguro de simulación</strong><br />Esta versión no realiza envíos reales de WhatsApp.</p></div>
    </aside>
  </main>;
}

export default function LoginPage() {
  return <Suspense fallback={<main className="login-page" />}><LoginForm /></Suspense>;
}
