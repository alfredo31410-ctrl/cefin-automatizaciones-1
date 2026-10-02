import Link from "next/link";
import { AutomationForm } from "@/components/automation-form";

export default function NewAutomationPage() {
  return <div className="page"><header className="page-header form-page-header"><div><Link className="back-link" href="/automatizaciones">← Volver a automatizaciones</Link><h1>Nueva automatización</h1><p>Configura una secuencia programada de mensajes para tus grupos.</p></div></header><AutomationForm /></div>;
}
