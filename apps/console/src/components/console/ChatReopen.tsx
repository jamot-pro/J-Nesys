"use client";

/**
 * Floating control to reopen the chat.
 *
 * A deliberate addition, NOT in the mockup: OrgConsole.dc.html leaves its
 * `chatClosed` branch empty and renders no fixed-position element at all, so
 * the only way back to the chat there is the app rail's icon — which changes
 * its tooltip and nothing else. That proved too easy to miss, so this adds a
 * visible affordance.
 *
 * It is built from the design system's own tokens so it still belongs to the
 * page, and it sits clear of the rail rather than over it.
 */
export function ChatReopen({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Open assistant chat"
      aria-label="Open assistant chat"
      style={{
        position: "fixed",
        left: 84,
        bottom: 20,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 44,
        padding: "0 18px 0 14px",
        background: "var(--color-accent)",
        color: "#fff",
        border: "none",
        borderRadius: 999,
        boxShadow: "var(--shadow-lg)",
        fontFamily: "var(--font-heading)",
        fontWeight: 800,
        fontSize: 12,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      Chat
    </button>
  );
}
