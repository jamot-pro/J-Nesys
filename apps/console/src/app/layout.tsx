import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";

import { DEFAULT_BRAND, loadOrgBranding } from "@/lib/org";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-archivo",
});

/** Title follows the organization, so a tab reads "Acme" not "Jamot". */
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

  // Branding is applied as CSS custom properties on <html> rather than by
  // generating per-org CSS: one build serves every organization, and an org
  // that has set no brand simply inherits the default palette.
  const style = {
    "--space-accent": org?.branding.accent ?? DEFAULT_BRAND.accent,
    "--space-accent-foreground":
      org?.branding.accentForeground ?? DEFAULT_BRAND.accentForeground,
  } as CSSProperties;

  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`} style={style}>
      <body className="h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
