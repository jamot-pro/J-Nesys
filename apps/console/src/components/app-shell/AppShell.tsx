"use client";

import { useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Grid2x2, ListTree, MessageCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette";
import { useAppShell } from "./app-shell-context";
import { MainWorkspace } from "./MainWorkspace";
import { AppRail, SECTION_ITEMS } from "./AppRail";
import { OrgRail } from "./OrgRail";
import { ChatPanel, useChatOpenState } from "./ChatPanel";
import { useBreakpoint } from "./use-breakpoint";

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

/** Floating reopen pill — mirrors OrgConsole.dc.html's `chat-reopen` button.
 * Shared by every breakpoint whenever the chat panel is collapsed. */
function ChatReopenPill({ onOpen }: { onOpen: () => void }) {
  return (
    <motion.button
      key="chat-reopen"
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.15 }}
      title="Open chat"
      aria-label="Open chat"
      onClick={onOpen}
      className="fixed bottom-5 left-5 z-40 flex h-11 items-center gap-2 rounded-full bg-space-accent px-4 font-display text-xs font-bold tracking-wide text-space-accent-foreground uppercase shadow-[var(--shadow-md)] transition-transform hover:-translate-y-px hover:shadow-[var(--shadow-lg)]"
    >
      <MessageCircle className="size-[17px]" />
      Chat
    </motion.button>
  );
}

/** Desktop shell — mirrors OrgConsole.dc.html's app-shell region: four flat
 * cards (chat, app rail, workspace, org rail) laid on the --background
 * ground with a consistent 12px gap, instead of one edge-to-edge resizable
 * surface. Only the chat panel resizes/collapses; the rails are fixed-width
 * and the workspace fills whatever is left. */
function DesktopShell() {
  const { chatOpen, setChatOpen, chatWidth, handleWidthChange } = useChatOpenState("jamot:shell:desktop");

  return (
    <div className="flex h-full w-full gap-3 overflow-hidden p-3">
      <AnimatePresence>
        {!chatOpen ? <ChatReopenPill onOpen={() => setChatOpen(true)} /> : null}
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

/** Tablet shell — same persistent rail/workspace/org-rail as desktop (there
 * is room for all three at >=768px), but the chat panel is a flat overlay
 * drawer instead of a fourth permanent column, to leave the workspace
 * enough width to be usable. */
function TabletShell() {
  const { chatOpen, setChatOpen } = useChatOpenState("jamot:shell:tablet", false);

  return (
    <div className="flex h-full w-full gap-3 overflow-hidden p-3">
      <AnimatePresence>
        {!chatOpen ? <ChatReopenPill onOpen={() => setChatOpen(true)} /> : null}
      </AnimatePresence>

      <AppRail />

      <div className="min-w-0 flex-1">
        <MainWorkspace />
      </div>

      <OrgRail />

      <AnimatePresence>
        {chatOpen ? (
          <>
            <motion.div
              className="fixed inset-0 z-30 bg-black/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setChatOpen(false)}
            />
            <motion.div
              className="fixed inset-y-3 left-3 z-40 w-[380px] max-w-[85vw]"
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
            >
              <ChatPanel resizable={false} onCollapse={() => setChatOpen(false)} />
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Mobile shell — the workspace fills the screen; the app rail, org rail
 * and chat panel (no room for any of them permanently) collapse into a
 * bottom bar with a real section/org menu sheet and a floating chat pill,
 * replacing the previous bottom nav whose People/Agents/Tasks/Apps buttons
 * opened a sheet with no actual navigation in it. */
function MobileShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { chatOpen, setChatOpen } = useChatOpenState("jamot:shell:mobile", false);
  const { activeSection, setActiveSection, spaces, space, setSpace } = useAppShell();

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-3">
      <div className="min-h-0 flex-1">
        <MainWorkspace />
      </div>

      {/* No floating reopen pill here — the bottom nav's own Chat button
          already opens it, and the pill (bottom-5 left-5) would collide
          with this nav bar on a phone-height viewport. */}
      <nav className="flex h-14 shrink-0 items-center justify-around rounded-[var(--radius-md)] bg-card shadow-[var(--shadow-sm)]">
        <Button
          variant="ghost"
          className="h-10 flex-1 gap-1.5 rounded-[var(--radius-sm)] text-xs font-medium"
          onClick={() => setMenuOpen(true)}
        >
          <ListTree className="size-4" />
          Menu
        </Button>
        <span className="h-7 w-px bg-border" />
        <Button
          variant="ghost"
          className="h-10 flex-1 gap-1.5 rounded-[var(--radius-sm)] text-xs font-medium"
          onClick={() => setChatOpen(true)}
        >
          <MessageCircle className="size-4" />
          Chat
        </Button>
      </nav>

      <AnimatePresence>
        {menuOpen ? (
          <>
            <motion.div
              className="fixed inset-0 z-30 bg-black/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="fixed inset-x-3 bottom-3 z-40 max-h-[75vh] overflow-y-auto rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-lg)]"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-base font-semibold">Menu</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-lg"
                  aria-label="Close"
                  onClick={() => setMenuOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>

              {spaces.length > 1 ? (
                <div className="mb-4">
                  <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Organization
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {spaces.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => setSpace(candidate.id)}
                        className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: candidate.accent }}
                        />
                        <span className="flex-1 truncate font-medium">{candidate.name}</span>
                        {candidate.id === space.id ? (
                          <Grid2x2 className="size-3.5 text-space-accent" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Sections
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {SECTION_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveSection(active ? null : item.id);
                        setMenuOpen(false);
                      }}
                      className="flex flex-col items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-3 text-center text-xs"
                      style={
                        active
                          ? { background: "color-mix(in srgb, var(--foreground) 12%, transparent)" }
                          : undefined
                      }
                    >
                      {item.d ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d={item.d} />
                        </svg>
                      ) : Icon ? (
                        <Icon className="size-5" />
                      ) : null}
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {chatOpen ? (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className="fixed inset-3 z-40"
          >
            <ChatPanel resizable={false} onCollapse={() => setChatOpen(false)} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
