import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";

import { brandStyle } from "@/lib/brand";
import { loadOrgBranding } from "@/lib/org";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-archivo",
});

/** Title follows the organization, so a tab reads "Acme", not "Jamot". */
export async function generateMetadata(): Promise<Metadata> {
  const org = await loadOrgBranding();
  return {
    title: org ? org.displayName : "Jamot Console",
    description: "Organization console",
    ...(org?.logoUrl ? { icons: { icon: org.logoUrl } } : {}),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const org = await loadOrgBranding();
  const style = brandStyle(org?.branding.accent);

  return (
    <html lang="en" className={archivo.variable} style={style}>
      <body style={{ background: "var(--color-surface)", color: "var(--color-text)" }}>
        {children}
      </body>
    </html>
  );
}
