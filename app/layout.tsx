import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CEFIN Automatizaciones",
  description: "Administración multilínea de automatizaciones de mensajería.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="es" className="h-full antialiased"><body className="min-h-full flex flex-col">{children}</body></html>;
}
