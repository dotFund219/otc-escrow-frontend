import React from "react"
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";
import { Toaster } from "sonner";

import "./globals.css";

const _inter = Inter({ subsets: ["latin"] });
const _jetbrains = JetBrains_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OTC Trading Platform - B2B Crypto OTC Desk",
  description:
    "Professional B2B OTC cryptocurrency trading platform with escrow, real-time pricing, and secure wallet integration.",
};

export const viewport: Viewport = {
  themeColor: "#0d1117",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
          </div>
          <Toaster
            theme="dark"
            position="top-right"
            toastOptions={{
              style: {
                background: "hsl(220 18% 10%)",
                border: "1px solid hsl(220 13% 18%)",
                color: "hsl(210 20% 95%)",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
