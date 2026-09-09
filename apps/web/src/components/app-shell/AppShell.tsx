"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Group,
  Panel,
  Separator,
  usePanelRef,
  type PanelSize,
} from "react-resizable-panels";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, House, MessageCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette";
import {
  DEFAULT_LEFT_SIZE,
  DEFAULT_RIGHT_SIZE,
  DEFAULT_SECTION_WIDTH,
  useAppShell,
  type SectionId,
} from "./app-shell-context";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { LeftSidebar } from "./LeftSidebar";
import { MainWorkspace } from "./MainWorkspace";
import { AppDock } from "./AppDock";
import { AppRail } from "./AppRail";
import { useBreakpoint } from "./use-breakpoint";

const LAYOUT_KEY = "jamot:shell:layout";
const LEFT_KEY = "jamot:left-collapsed";
/** When the center (chat) panel is narrower than this, collapse it into a floating bubble. */
const CHAT_COMPACT_WIDTH = 340;
/** Size of the round chat bubble and the gap kept between it and the dock. */
const BUBBLE_SIZE = 48;
const BUBBLE_GAP = 12;

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

function DesktopShell() {
  const { setLeftSize, setRightSize, activeSection, activeAppId, setActiveSection } =
    useAppShell();
  const leftRef = usePanelRef();
  const rightRef = usePanelRef();
  const mainRef = usePanelRef();
  const restoredRef = useRef(false);
  const [leftCollapsed, setLeftCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(LEFT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [dockCollapsed, setDockCollapsed] = useState(true);
  const [chatCompact, setChatCompact] = useState(false);
  const [chatPopupOpen, setChatPopupOpen] = useState(false);
  const dockHostRef = useRef<HTMLDivElement | null>(null);
  const [dockLeft, setDockLeft] = useState<number | null>(null);
  const railDragStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!rightRef.current) return;
    if (activeSection || activeAppId) {
      if (rightRef.current.isCollapsed()) {
        rightRef.current.expand();
      }
      const current = rightRef.current.getSize();
      if (current.inPixels < DEFAULT_SECTION_WIDTH) {
        rightRef.current.resize(DEFAULT_SECTION_WIDTH);
      }
    } else if (!rightRef.current.isCollapsed()) {
      rightRef.current.collapse();
    }
  }, [activeSection, activeAppId, rightRef]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LEFT_KEY, leftCollapsed ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [leftCollapsed]);

  // Restore persisted sizes whenever the resizable shell (re)mounts.
  useEffect(() => {
    if (chatCompact) return;
    const frame = requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(LAYOUT_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as { left?: number; right?: number };
          if (typeof saved.left === "number" && saved.left >= 1) {
            leftRef.current?.resize(saved.left);
          }
        }
      } catch {
        // Ignore malformed layout data.
      } finally {
        restoredRef.current = true;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [chatCompact, leftRef, rightRef]);

  // Keep the left panel's collapsed state in sync when the shell (re)mounts.
  useEffect(() => {
    if (chatCompact) return;
    if (leftCollapsed) leftRef.current?.collapse();
    else leftRef.current?.expand();
  }, [chatCompact, leftCollapsed, leftRef]);

  const persistSize = (which: "left" | "right", value: number) => {
    if (!restoredRef.current) return;
    try {
      const raw = window.localStorage.getItem(LAYOUT_KEY);
      const data = raw
        ? (JSON.parse(raw) as Record<string, unknown>)
        : {};
      data[which] = Math.round(value);
      window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage errors.
    }
  };

  const handleLeftResize = (size: PanelSize) => {
    setLeftSize(size.inPixels);
    setLeftCollapsed(size.inPixels < 1);
    persistSize("left", size.inPixels);
  };

  const handleRightResize = (size: PanelSize) => {
    setRightSize(size.inPixels);
    setDockCollapsed(size.inPixels < 1);
    persistSize("right", size.inPixels);
  };

  const handleMainResize = (size: PanelSize) => {
    setChatCompact(size.inPixels < CHAT_COMPACT_WIDTH);
  };

  const toggleLeft = () => {
    const panel = leftRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  };

  const toggleDock = () => {
    const panel = rightRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      // Open Dashboard when expanding the dock
      setActiveSection("dashboard");
    } else {
      panel.collapse();
    }
  };

  const restoreChat = () => {
    setChatPopupOpen(false);
    setChatCompact(false);
  };

  const handleSelectSection = (id: SectionId) => {
    setChatPopupOpen(false);
    setActiveSection(activeSection === id ? null : id);
  };

  // Grab the right edge of the magnetic rail and drag it rightward to restore
  // the full resizable shell.
  const startRailDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    railDragStartX.current = event.clientX;
    const cleanup = () => {
      railDragStartX.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    const onMove = (e: PointerEvent) => {
      if (railDragStartX.current != null && e.clientX - railDragStartX.current > 12) {
        cleanup();
        restoreChat();
      }
    };
    const onUp = () => cleanup();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Anchor the chat bubble/popup to the bottom-left of the right dock.
  useEffect(() => {
    if (!chatCompact) return;
    const el = dockHostRef.current;
    if (!el) return;
    const update = () => setDockLeft(el.getBoundingClientRect().left);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [chatCompact]);

  return (
    <>
      {chatCompact ? (
        <div className="flex h-full w-full overflow-hidden">
          <div className="flex h-full w-60 shrink-0">
            <LeftSidebar />
          </div>
          {/* Icon-only rail in compact mode — never expanded */}
          <div className="shrink-0 border-r border-border/40">
            <AppRail onSelectSection={handleSelectSection} />
          </div>
          <div
            role="separator"
            aria-label="Drag right to restore full layout"
            title="Drag right to restore full layout"
            onPointerDown={startRailDrag}
            className="flex w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-border/40 transition-colors hover:bg-space-accent/50"
          >
            <span className="h-8 w-0.5 rounded-full bg-muted-foreground/40" />
          </div>
          <div className="min-w-0 flex-1" />
          <div
            ref={dockHostRef}
            className="flex h-full shrink-0"
            style={{ width: activeSection || activeAppId ? DEFAULT_RIGHT_SIZE : 0 }}
          >
            {activeSection || activeAppId ? <AppDock /> : null}
          </div>
        </div>
      ) : (
        <div className="relative flex h-full w-full overflow-hidden">
          {/* One resizable group: Left | Center | Right dock. The dock shares
              the group with the center so dragging it all the way squeezes the
              center; below CHAT_COMPACT_WIDTH the chat collapses into the
              floating bubble (chatCompact branch below). */}
          <Group
            id="jamot-shell"
            orientation="horizontal"
            className="h-full min-w-0 flex-1"
          >
            <Panel
              id="left"
              defaultSize={DEFAULT_LEFT_SIZE}
              minSize={0}
              maxSize={320}
              collapsible
              collapsedSize={0}
              panelRef={leftRef}
              onResize={handleLeftResize}
              className="h-full"
            >
              <LeftSidebar />
            </Panel>

            <Separator
              id="sep-left"
              className="w-px bg-border/40 transition-colors hover:bg-space-accent/40 data-[separator=active]:bg-space-accent/50"
            />

            <Panel
              id="main"
              minSize={0}
              collapsible
              collapsedSize={0}
              panelRef={mainRef}
              onResize={handleMainResize}
              className="h-full"
            >
              <MainWorkspace
                onToggleLeft={toggleLeft}
                leftOpen={!leftCollapsed}
                onToggleDock={toggleDock}
                dockOpen={!dockCollapsed}
              />
            </Panel>

            <Separator
              id="sep-right"
              className="w-px bg-border/40 transition-colors hover:bg-space-accent/40 data-[separator=active]:bg-space-accent/50"
            />

            <Panel
              id="right"
              defaultSize={DEFAULT_RIGHT_SIZE}
              minSize={0}
              maxSize="65%"
              collapsible
              collapsedSize={0}
              panelRef={rightRef}
              onResize={handleRightResize}
              className="h-full"
            >
              <AppDock />
            </Panel>
          </Group>

          {/* AppRail: narrow by default, widens inline when its add-apps menu opens */}
          <div className="shrink-0 border-l border-border/40">
            <AppRail
              onSelectSection={handleSelectSection}
              onOpenAddApps={() => {
                const panel = rightRef.current;
                if (panel?.isCollapsed()) panel.expand();
              }}
            />
          </div>
        </div>
      )}

      <AnimatePresence>
        {chatCompact ? (
          <motion.div
            key="chat-bubble"
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.9 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-5 z-50"
            style={
              dockLeft != null
                ? {
                    left: dockLeft - BUBBLE_SIZE - BUBBLE_GAP,
                    transition: "left 200ms ease",
                  }
                : { right: 20 }
            }
          >
            <Button
              size="icon"
              className="size-12 rounded-full bg-space-accent text-space-accent-foreground shadow-xl transition-transform hover:scale-105"
              aria-label={chatPopupOpen ? "Close AI assistant" : "Open AI assistant"}
              onClick={() => setChatPopupOpen((value) => !value)}
            >
              {chatPopupOpen ? (
                <X className="size-5" />
              ) : (
                <MessageCircle className="size-5" />
              )}
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {chatCompact && chatPopupOpen ? (
          <motion.div
            key="chat-popup"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="glass-card glass-border fixed bottom-24 z-50 flex h-[540px] w-[420px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl shadow-2xl backdrop-blur-xl"
            style={
              dockLeft != null
                ? { left: dockLeft - 420 - BUBBLE_GAP, transition: "left 200ms ease" }
                : { right: 20 }
            }
          >
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 px-3.5">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-space-accent animate-pulse" />
                <span className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Control
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                aria-label="Minimize chat"
                onClick={() => setChatPopupOpen(false)}
              >
                <ChevronDown className="size-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              <ChatWorkspace />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
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
        <MainWorkspace
          onToggleDock={() => setDockOpen((value) => !value)}
          dockOpen={dockOpen}
        />
        <AnimatePresence>
          {dockOpen ? (
            <>
              <motion.div
                className="absolute inset-0 z-20 bg-black/20 backdrop-blur-xs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDockOpen(false)}
              />
              <motion.div
                className="glass-card absolute inset-y-0 right-0 z-30 w-84 max-w-[85vw] rounded-l-3xl shadow-2xl"
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

      <nav className="glass border-t border-border/40 flex shrink-0 items-center gap-1 px-3 py-2">
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
            className="glass-card fixed inset-x-0 bottom-0 z-50 shrink-0 rounded-t-3xl border-t border-border/40 p-5 shadow-2xl"
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
