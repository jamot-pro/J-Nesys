import type { Metadata } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { brandStyle } from "@/lib/brand";
import { loadOrgBranding } from "@/lib/org";
import "./globals.css";

// Modernist design system: Archivo for both heading and body (see
// src/app/design-system.css). globals.css's @theme block points Tailwind's
// font-sans/font-display at this variable, so migrated app routes don't
// need to change their className usage.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-archivo",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

/** Title/icon follow the organization, so a tab reads "Acme", not "Jamot". */
export async function generateMetadata(): Promise<Metadata> {
  const org = await loadOrgBranding();
  return {
    title: org ? org.displayName : "Jamot",
    description: "Universal organizational kernel",
    icons: { icon: org?.logoUrl ?? "/brand/jamot-logo.png" },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const org = await loadOrgBranding();
  const style = brandStyle(org?.branding.accent);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${geistMono.variable} h-full antialiased`}
      style={style}
    >
      <body className="h-full bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
