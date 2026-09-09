"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { House, MessageCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette";
import { useAppShell } from "./app-shell-context";
import { LeftSidebar } from "./LeftSidebar";
import { MainWorkspace } from "./MainWorkspace";
import { AppDock } from "./AppDock";
import { AppRail } from "./AppRail";
import { OrgRail } from "./OrgRail";
import { ChatPanel, CHAT_PANEL_DEFAULT_WIDTH } from "./ChatPanel";
import { useBreakpoint } from "./use-breakpoint";

const CHAT_OPEN_KEY = "jamot:shell:chat-open";
const CHAT_WIDTH_KEY = "jamot:shell:chat-width";

export function AppShell() {
  return <AppShellInner />;
}

function AppShellInner() {
  const { space } = useAppShell();
  const breakpoint = useBreakpoint();

  const style = {
    "--space-accent": space.accent,
    "--space-accent-foreground": space.accentForeground,
  } as CSSProperties;

  return (
    <>
      <div
        style={style}
        className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground selection:bg-space-accent/20 selection:text-space-accent"
      >
        {breakpoint === "desktop" ? <DesktopShell /> : null}
        {breakpoint === "tablet" ? <TabletShell /> : null}
        {breakpoint === "mobile" ? <MobileShell /> : null}
      </div>
      <CommandPalette />
    </>
  );
}

/** Desktop shell — mirrors OrgConsole.dc.html's app-shell region: four flat
 * cards (chat, app rail, workspace, org rail) laid on the --background
 * ground with a consistent 12px gap, instead of one edge-to-edge resizable
 * surface. Only the chat panel resizes/collapses; the rails are fixed-width
 * and the workspace fills whatever is left. */
function DesktopShell() {
  const [chatOpen, setChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(CHAT_PANEL_DEFAULT_WIDTH);

  useEffect(() => {
    try {
      const openRaw = window.localStorage.getItem(CHAT_OPEN_KEY);
      if (openRaw != null) setChatOpen(openRaw === "1");
      const widthRaw = window.localStorage.getItem(CHAT_WIDTH_KEY);
      if (widthRaw) {
        const parsed = Number(widthRaw);
        if (Number.isFinite(parsed) && parsed > 0) setChatWidth(parsed);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_OPEN_KEY, chatOpen ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [chatOpen]);

  const handleWidthChange = (width: number) => {
    setChatWidth(width);
    try {
      window.localStorage.setItem(CHAT_WIDTH_KEY, String(Math.round(width)));
    } catch {
      // ignore storage errors
    }
  };

  return (
    <div className="flex h-full w-full gap-3 overflow-hidden p-3">
      <AnimatePresence>
        {!chatOpen ? (
          <motion.button
            key="chat-reopen"
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            title="Open chat"
            aria-label="Open chat"
            onClick={() => setChatOpen(true)}
            className="fixed bottom-5 left-5 z-40 flex h-11 items-center gap-2 rounded-full bg-space-accent px-4 font-display text-xs font-bold tracking-wide text-space-accent-foreground uppercase shadow-[var(--shadow-md)] transition-transform hover:-translate-y-px hover:shadow-[var(--shadow-lg)]"
          >
            <MessageCircle className="size-[17px]" />
            Chat
          </motion.button>
        ) : null}
      </AnimatePresence>

      {chatOpen ? (
        <ChatPanel
          width={chatWidth}
          onWidthChange={handleWidthChange}
          onCollapse={() => setChatOpen(false)}
        />
      ) : null}

      <AppRail />

      <div className="min-w-0 flex-1">
        <MainWorkspace />
      </div>

      <OrgRail />
    </div>
  );
}

function TabletShell() {
  const [dockOpen, setDockOpen] = useState(false);

  return (
    <div className="flex h-full w-full">
      <div className="w-56 shrink-0 border-r border-border/40">
        <LeftSidebar />
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          <div className="flex h-11 shrink-0 items-center justify-end border-b border-border/40 px-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs"
              onClick={() => setDockOpen((value) => !value)}
            >
              Apps
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <MainWorkspace />
          </div>
        </div>
        <AnimatePresence>
          {dockOpen ? (
            <>
              <motion.div
                className="absolute inset-0 z-20 bg-black/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDockOpen(false)}
              />
              <motion.div
                className="absolute inset-y-0 right-0 z-30 w-84 max-w-[85vw] rounded-l-[var(--radius-lg)] bg-card shadow-[var(--shadow-lg)]"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              >
                <AppDock />
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

const MOBILE_SECTIONS = ["People", "Agents", "Tasks", "Apps"];

function MobileShell() {
  const [sheet, setSheet] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        <MainWorkspace />
      </div>

      <nav className="flex shrink-0 items-center gap-1 border-t border-border bg-card px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 rounded-xl text-xs font-medium"
          onClick={() => setSheet((value) => (value === "nav" ? null : "nav"))}
        >
          <House className="size-4" />
          Nav
        </Button>
        {MOBILE_SECTIONS.map((section) => (
          <Button
            key={section}
            variant="ghost"
            size="sm"
            className="flex-1 rounded-xl text-xs font-medium"
            onClick={() => setSheet((value) => (value === section ? null : section))}
          >
            {section}
          </Button>
        ))}
      </nav>

      <AnimatePresence>
        {sheet ? (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-50 shrink-0 rounded-t-[var(--radius-lg)] border-t border-border bg-card p-5 shadow-[var(--shadow-lg)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">
                {sheet === "nav" ? "Navigation" : sheet}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-lg"
                aria-label="Close"
                onClick={() => setSheet(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Press ⌘K to quickly search and switch between all sections.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
