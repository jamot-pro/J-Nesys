"use client";

import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationsProvider } from "@/components/notifications/notifications-context";
import { SectionContent, useSectionTitle } from "./SectionContent";

/** The persistent main panel (desktop): always shows the current
 * section/app, falling back to the dashboard when nothing is selected —
 * this is the "workspace" region in the Modernist shell, not a closable
 * dock (that's AppDock, kept for tablet/mobile overlays). */
export function MainWorkspace() {
  const title = useSectionTitle();

  return (
    <NotificationsProvider>
      <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] bg-card text-card-foreground shadow-[var(--shadow-md)]">
        <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border px-4">
          <span className="font-display text-sm font-semibold tracking-tight">
            {title}
          </span>
          <NotificationBell />
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <SectionContent />
        </div>
      </div>
    </NotificationsProvider>
  );
}
