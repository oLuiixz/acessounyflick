import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UnyFlick — Seu teste grátis",
  description: "Teste UnyFlick por 2 horas.",
  icons: {
    icon: "/images/favicon.webp",
    shortcut: "/images/favicon.webp",
    apple: "/images/favicon.webp",
  },
};

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}