import { useEffect, useRef } from "react";
import { Mic, Send } from "lucide-react";
import { useApp } from "../context/AppContext";
import { SubHeader } from "../components/SubHeader";

export function TalkScreen() {
  const { messages, thinking, draft, setDraft, send, availability } = useApp();
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <SubHeader title="Talk" right={availability.available ? "Available" : "Unavailable"} />
      <div ref={logRef} style={{ flex: 1, overflowY: "auto", padding: "16px 14px 6px", display: "flex", flexDirection: "column", gap: 14 }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              animation: "jm-fade .25s ease-out",
              display: "flex",
              flexDirection: "column",
              gap: 5,
              alignSelf: m.who === "you" ? "flex-end" : "flex-start",
              maxWidth: "86%",
            }}
          >
            <span
              style={{
                fontSize: 10,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: m.who === "you" ? "var(--color-neutral-600)" : "var(--color-accent-700)",
              }}
            >
              {m.who === "you" ? "You" : "Jamot"}
            </span>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.55,
                padding: "11px 13px",
                borderRadius: "var(--radius-md)",
                background: m.who === "you" ? "var(--color-accent)" : "var(--color-bg)",
                color: m.who === "you" ? "#fff" : "var(--color-text)",
                boxShadow: m.who === "you" ? "none" : "var(--shadow-sm)",
              }}
            >
              {m.text}
            </p>
            {m.action && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  alignSelf: "flex-start",
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "var(--color-accent-100)",
                  color: "var(--color-accent-700)",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {m.action}
              </span>
            )}
          </div>
        ))}
        {thinking && (
          <span style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-accent-700)" }}>
            Jamot <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 999, background: "var(--color-accent)", marginLeft: 4, animation: "jm-blink 1s infinite" }} />
          </span>
        )}
      </div>
      <div
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px calc(16px + env(safe-area-inset-bottom, 0px))",
          background: "var(--color-bg)",
          borderTop: "1px solid var(--color-divider)",
        }}
      >
        <button
          title="Voice"
          style={{
            all: "unset",
            cursor: "pointer",
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface)",
          }}
        >
          <Mic size={18} strokeWidth={1.9} />
        </button>
        <input
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder="Tell Jamot what's happening"
          style={{ flex: 1, height: 40, borderRadius: "var(--radius-sm)", background: "var(--color-surface)", fontSize: 14 }}
        />
        <button
          onClick={() => void send()}
          title="Send"
          style={{
            all: "unset",
            cursor: "pointer",
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-accent)",
            color: "#fff",
          }}
        >
          <Send size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
