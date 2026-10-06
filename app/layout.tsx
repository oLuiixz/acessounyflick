import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://acessounyflick.vercel.app";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "UnyFlick",
      inLanguage: "pt-BR",
      description:
        "UnyFlick para assistir filmes, séries e canais ao vivo em diferentes dispositivos.",
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "UnyFlick",
      url: siteUrl,
      logo: `${siteUrl}/images/logounyflick.webp`,
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "UnyFlick - O paraíso do cinema!",
  description:
    "Conheça a UnyFlick e veja como acessar filmes, séries e canais ao vivo pelo celular, Smart TV, TV Box, Fire TV Stick ou computador.",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteUrl,
    siteName: "UnyFlick",
    title: "UnyFlick - O paraíso do cinema!",
    description:
      "Filmes, séries e canais ao vivo no celular, Smart TV, TV Box, Fire TV Stick ou computador.",
    images: [
      {
        url: "/images/logounyflick.webp",
        alt: "Logo UnyFlick",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UnyFlick - O paraíso do cinema!",
    description:
      "Filmes, séries e canais ao vivo no celular, Smart TV, TV Box, Fire TV Stick ou computador.",
    images: ["/images/logounyflick.webp"],
  },
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}