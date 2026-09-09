"use client";

import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationsProvider } from "@/components/notifications/notifications-context";

export interface MainWorkspaceProps {
  onToggleLeft?: () => void;
  leftOpen?: boolean;
  onToggleDock?: () => void;
  dockOpen?: boolean;
}

export function MainWorkspace({
  onToggleLeft,
  leftOpen = true,
  onToggleDock,
  dockOpen = true,
}: MainWorkspaceProps) {
  return (
    <NotificationsProvider>
      <div className="relative flex h-full flex-col overflow-hidden">
        {/* Floating subtle corner controls */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-center justify-between">
          <div className="pointer-events-auto flex items-center gap-1">
            {onToggleLeft ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-xl bg-background/50 text-muted-foreground backdrop-blur-sm transition-all hover:bg-background hover:text-foreground shadow-xs"
                aria-label="Toggle left sidebar"
                onClick={onToggleLeft}
              >
                {leftOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
              </Button>
            ) : null}
          </div>

          <div className="pointer-events-auto flex items-center gap-1">
            <div className="rounded-xl bg-background/50 backdrop-blur-sm shadow-xs">
              <NotificationBell />
            </div>
            {onToggleDock ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-xl bg-background/50 text-muted-foreground backdrop-blur-sm transition-all hover:bg-background hover:text-foreground shadow-xs"
                aria-label="Toggle context dock"
                onClick={onToggleDock}
              >
                {dockOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
              </Button>
            ) : null}
          </div>
        </div>

        <main className="flex min-h-0 flex-1 flex-col pt-2">
          <ChatWorkspace />
        </main>
      </div>
    </NotificationsProvider>
  );
}
