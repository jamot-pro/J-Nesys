import type { Metadata } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { Providers } from "@/app/providers";
import "./globals.css";

// Modernist design system: Archivo for both heading and body (see
// project/readme.md / project/styles.css). globals.css's @theme block points
// Tailwind's font-sans/font-display at this variable, so the ~40 files using
// those classes don't need to change.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-archivo",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Jamot",
  description: "Universal organizational kernel",
  icons: {
    icon: "/brand/jamot-logo.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
