"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionContent, useSectionTitle, useHasSectionContent } from "./SectionContent";
import { useAppShell } from "./app-shell-context";

/** Tablet/mobile overlay dock: shows the current section/app as a closable
 * aside. Desktop uses MainWorkspace (a persistent panel, no close button)
 * instead — both render through SectionContent so the two never drift. */
export function AppDock() {
  const { setActiveSection, closeApp, activeAppId } = useAppShell();
  const hasContent = useHasSectionContent();
  const title = useSectionTitle();

  if (!hasContent) return null;

  return (
    <aside className="flex h-full flex-col bg-card text-card-foreground">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
          aria-label="Close"
          onClick={() => (activeAppId ? closeApp() : setActiveSection(null))}
        >
          <X className="size-3.5" />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <SectionContent />
      </div>
    </aside>
  );
}
