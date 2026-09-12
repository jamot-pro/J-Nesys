"use client";

import { useState } from "react";

export interface ChatMessage {
  who: string;
  text: string;
}

/** Chat panel — a direct port of OrgConsole.dc.html's `chat` region
 * (lines 21–88), styles verbatim.
 *
 * No agent runtime is wired yet: messages are echoed into local state so the
 * surface behaves, and the transcript starts empty rather than replaying the
 * mockup's scripted MARA/CONSOLE exchange, which was illustrative fixture
 * text. Wiring this to the real agent comes later.
 */
export function ChatPanel({
  width,
  onWidthChange,
  onCollapse,
}: {
  width: number;
  onWidthChange: (w: number) => void;
  onCollapse: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");

  function startResize(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const move = (ev: PointerEvent) =>
      onWidthChange(Math.min(560, Math.max(300, startWidth + (ev.clientX - startX))));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function send() {
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [...m, { who: "You", text }]);
    setDraft("");
  }

  return (
    <div data-chat-panel="1" style={{ flex: "none", position: "relative", width }}>
      <div
        onPointerDown={startResize}
        onDoubleClick={() => onWidthChange(360)}
        title="Drag to resize the chat panel"
        style={{ position: "absolute", top: 0, right: -3, bottom: 0, width: 6, cursor: "col-resize", zIndex: 10 }}
      />
      <aside
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "var(--color-bg)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            height: 52,
            padding: "0 var(--space-2) 0 var(--space-3)",
            borderBottom: "1px solid var(--color-divider)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
            {/* eslint-disable @next/next/no-img-element */}
            <img className="mark-light" src="/brand/jamot-wordmark.png" alt="Jamot" style={{ height: 19, width: "auto" }} />
            <img className="mark-dark" src="/brand/jamot-wordmark-white.png" alt="Jamot" style={{ height: 19, width: "auto" }} />
            {/* eslint-enable @next/next/no-img-element */}
          </div>
          <button className="btn btn-ghost btn-icon" title="New chat" style={{ flex: "none" }} onClick={() => setMessages([])}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </button>
          <button className="btn btn-ghost btn-icon" title="Collapse chat panel" style={{ flex: "none" }} onClick={onCollapse}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
            </svg>
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "var(--space-4) var(--space-3)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                margin: "auto",
                textAlign: "center",
                padding: "var(--space-4)",
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 14 }}>New chat</span>
              <span
                style={{
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "color-mix(in srgb, var(--color-text) 74%, transparent)",
                  maxWidth: "26ch",
                }}
              >
                Ask about the organization, or tell an agent what to do next.
              </span>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "color-mix(in srgb, var(--color-text) 76%, transparent)",
                  }}
                >
                  {m.who}
                </span>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{m.text}</p>
              </div>
            ))
          )}
        </div>

        <div style={{ flex: "none", borderTop: "1px solid var(--color-divider)", padding: "var(--space-3)" }}>
          <textarea
            className="input"
            rows={3}
            placeholder="Ask about the organization, or instruct a change…"
            style={{ resize: "none", minHeight: 72 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={send}>
              Send
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}>
                <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
              </svg>
            </button>
            <button className="btn btn-secondary btn-icon" title="Attach knowledge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
