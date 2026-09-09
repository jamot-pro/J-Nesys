"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { History, PanelLeftClose, SquarePen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { ChatHistory } from "@/components/chat/ChatHistory";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

export const CHAT_PANEL_DEFAULT_WIDTH = 360;
export const CHAT_PANEL_MIN_WIDTH = 300;
export const CHAT_PANEL_MAX_WIDTH = 560;

interface ChatPanelProps {
  width: number;
  onWidthChange: (width: number) => void;
  onCollapse: () => void;
}

/** Left-hand chat card — mirrors OrgConsole.dc.html's `chat` region: a flat
 * panel (no blur) with a compact header, an optional history drawer, the
 * live CopilotKit conversation, and a drag handle on the right edge. */
export function ChatPanel({ width, onWidthChange, onCollapse }: ChatPanelProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const widthRef = useRef(width);
  widthRef.current = width;

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
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
    <div className="relative h-full shrink-0" style={{ width }}>
      <div
        onPointerDown={startResize}
        onDoubleClick={() => onWidthChange(CHAT_PANEL_DEFAULT_WIDTH)}
        title="Drag to resize the chat panel"
        className="absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize"
      />
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
