import Link from "next/link";
import { AutomationForm } from "@/components/automation-form";

export default async function EditAutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="page"><header className="page-header form-page-header"><div><Link className="back-link" href={`/automatizaciones/${id}`}>← Volver al detalle</Link><h1>Editar automatización</h1><p>Actualiza la información, los grupos o la programación.</p></div></header><AutomationForm automationId={id} /></div>;
}
