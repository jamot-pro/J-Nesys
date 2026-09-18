"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { History, PanelLeftClose, SquarePen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { ChatHistory } from "@/components/chat/ChatHistory";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

export const CHAT_PANEL_DEFAULT_WIDTH = 360;
export const CHAT_PANEL_MIN_WIDTH = 300;
export const CHAT_PANEL_MAX_WIDTH = 560;

/** Persists the chat panel's open/width state to localStorage under a
 * caller-chosen key prefix, so desktop/tablet/mobile can each remember
 * their own chat state independently. `defaultOpen` should be true only
 * where the chat has its own persistent column (desktop) — on tablet/mobile
 * it renders as a full overlay drawer, so opening it by default on first
 * visit would hide the rest of the shell behind a backdrop before the user
 * asked for it. */
export function useChatOpenState(keyPrefix: string, defaultOpen = true) {
  const [chatOpen, setChatOpen] = useState(defaultOpen);
  const [chatWidth, setChatWidth] = useState(CHAT_PANEL_DEFAULT_WIDTH);
  const openKey = `${keyPrefix}:chat-open`;
  const widthKey = `${keyPrefix}:chat-width`;

  useEffect(() => {
    try {
      const openRaw = window.localStorage.getItem(openKey);
      if (openRaw != null) setChatOpen(openRaw === "1");
      const widthRaw = window.localStorage.getItem(widthKey);
      if (widthRaw) {
        const parsed = Number(widthRaw);
        if (Number.isFinite(parsed) && parsed > 0) setChatWidth(parsed);
      }
    } catch {
      // ignore storage errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(openKey, chatOpen ? "1" : "0");
    } catch {
      // ignore storage errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen]);

  const handleWidthChange = (width: number) => {
    setChatWidth(width);
    try {
      window.localStorage.setItem(widthKey, String(Math.round(width)));
    } catch {
      // ignore storage errors
    }
  };

  return { chatOpen, setChatOpen, chatWidth, handleWidthChange };
}

interface ChatPanelProps {
  /** Fixed pixel width with a drag handle (desktop column). Omit together
   * with `resizable={false}` to have the panel fill its container instead
   * (a tablet/mobile drawer that already controls its own width). */
  width?: number;
  onWidthChange?: (width: number) => void;
  onCollapse: () => void;
  resizable?: boolean;
}

/** Chat card — mirrors OrgConsole.dc.html's `chat` region: a flat panel (no
 * blur) with a compact header, an optional history drawer, the live
 * CopilotKit conversation, and (when resizable) a drag handle on the right
 * edge. Used both as a persistent desktop column and, non-resizable, inside
 * a tablet/mobile overlay drawer. */
export function ChatPanel({ width, onWidthChange, onCollapse, resizable = true }: ChatPanelProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const widthRef = useRef(width ?? CHAT_PANEL_DEFAULT_WIDTH);
  widthRef.current = width ?? widthRef.current;

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!onWidthChange) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    const onMove = (moveEvent: PointerEvent) => {
      const next = startWidth + (moveEvent.clientX - startX);
      onWidthChange(Math.min(CHAT_PANEL_MAX_WIDTH, Math.max(CHAT_PANEL_MIN_WIDTH, next)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      className={resizable ? "relative h-full shrink-0" : "relative h-full w-full"}
      style={resizable ? { width } : undefined}
    >
      {resizable ? (
        <div
          onPointerDown={startResize}
          onDoubleClick={() => onWidthChange?.(CHAT_PANEL_DEFAULT_WIDTH)}
          title="Drag to resize the chat panel"
          className="absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize"
        />
      ) : null}
      <aside className="flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] bg-card text-card-foreground shadow-[var(--shadow-sm)]">
        <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border py-0 pr-2 pl-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <BrandLogo className="h-[19px] w-auto" alt="Jamot" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-[var(--radius-sm)] text-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]"
            aria-label="New chat"
            title="New chat"
            onClick={() => setThreadId(crypto.randomUUID())}
          >
            <SquarePen className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-[var(--radius-sm)] text-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]"
            aria-label={historyOpen ? "Hide chat history" : "Show chat history"}
            title={historyOpen ? "Hide chat history" : "Show chat history"}
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <History className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-[var(--radius-sm)] text-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]"
            aria-label="Collapse chat panel"
            title="Collapse chat panel"
            onClick={onCollapse}
          >
            <PanelLeftClose className="size-4" />
          </Button>
        </div>

        {historyOpen ? (
          <div className="max-h-[246px] shrink-0 overflow-y-auto border-b border-border">
            <div className="px-2 pt-2">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search history…"
                className="h-7 w-full rounded-[var(--radius-sm)] border border-border bg-background px-2 text-xs outline-none focus:border-space-accent"
              />
            </div>
            <ChatHistory searchQuery={query} />
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">
          <ChatWorkspace threadId={threadId} />
        </div>
      </aside>
    </div>
  );
}
