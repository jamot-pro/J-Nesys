"use client";

import type { ReactNode } from "react";

import { CopilotKit } from "@copilotkit/react-core/v2";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth/auth-context";
import { AuthGate } from "@/components/auth/AuthGate";
import { AppShellProvider } from "@/components/app-shell/app-shell-context";
import { catalog, theme } from "@/components/a2ui/a2ui-catalog";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <AuthGate>
          <AppShellProvider>
            <CopilotKit runtimeUrl="/api/copilotkit" a2ui={{ theme, catalog }}>
              {children}
            </CopilotKit>
          </AppShellProvider>
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  );
}
