import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Plata — tus finanzas en segundos",
  description: "Captura tus finanzas en segundos y obtén claridad total de tu dinero sin hojas de cálculo.",
  manifest: "/manifest.webmanifest",
  applicationName: "Plata",
  appleWebApp: { capable: true, title: "Plata", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icons/192" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#090b0f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <Suspense>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
