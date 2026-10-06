import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UnyFlick - O paraíso do cinema!",
  description: "Teste UnyFlick por 2 horas.",
  };

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}