import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "@fontsource-variable/inter";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Plata — tus finanzas en segundos",
  description: "Captura tus finanzas en segundos y obtén claridad total de tu dinero sin hojas de cálculo.",
  manifest: "/manifest.webmanifest",
  applicationName: "Plata",
  appleWebApp: { capable: true, title: "Plata", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icons/icon-192.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f7f9",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="light" style={{ colorScheme: "light" }}>
      <body className="font-sans">
        <Suspense>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
