"use client";

import { iconForCatalogApp, type RailApp } from "./mockup-data";

const ICON_BTN: React.CSSProperties = {
  width: 44,
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text)",
  cursor: "pointer",
};

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.85 }}
    >
      <path d={d} />
    </svg>
  );
}

/** App rail — a direct port of OrgConsole.dc.html's `app-rail` region
 * (lines 89–135). Inline styles are the mockup's, kept verbatim. */
export function AppRail({
  apps,
  activeId,
  onOpenApp,
  onHome,
  onOpenChannels,
  onToggleChat,
  chatOpen,
  onOpenWallet,
  onOpenConfig,
  onCycleTheme,
  themeIcon,
}: {
  apps: RailApp[];
  activeId: string | null;
  onOpenApp: (id: string) => void;
  onHome: () => void;
  onOpenChannels: () => void;
  onToggleChat: () => void;
  /** Drives the chat button's label, as the mockup does:
   * railChatTitle = chatOpen ? 'Hide assistant chat' : 'Open assistant chat'. */
  chatOpen: boolean;
  onOpenWallet: () => void;
  onOpenConfig: () => void;
  onCycleTheme: () => void;
  themeIcon: string;
}) {
  return (
    <nav
      data-copilot-region="app-rail"
      style={{
        flex: "none",
        width: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "var(--color-bg)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: "none",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 52,
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <button onClick={onHome} title="Discover dreams" style={{ ...ICON_BTN }}>
          {/* eslint-disable @next/next/no-img-element */}
          <img className="mark-light" src="/brand/jamot-logo.webp" alt="Jamot" width={26} height={26} />
          <img className="mark-dark" src="/brand/jamot-logo-white.webp" alt="Jamot" width={26} height={26} />
          {/* eslint-enable @next/next/no-img-element */}
        </button>
      </div>

      <div
        style={{
          flex: 1,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          padding: "var(--space-2) 0",
          overflowY: "auto",
        }}
      >
        {apps.length === 0 ? (
          <button
            onClick={onOpenConfig}
            title="No apps installed — open Apps settings"
            style={{
              ...ICON_BTN,
              border: "1px dashed var(--color-divider)",
              cursor: "pointer",
            }}
          >
            <Icon d="M12 5v14M5 12h14" />
          </button>
        ) : null}
        {apps.map((app) => {
          const active = app.id === activeId;
          return (
            <div key={app.id} data-app-id={app.id} style={{ position: "relative", width: 44, height: 44, flex: "none" }}>
              <button
                title={app.title}
                onClick={() => onOpenApp(app.id)}
                style={{
                  ...ICON_BTN,
                  cursor: "pointer",
                  background: active
                    ? "color-mix(in srgb,var(--color-text) 12%,transparent)"
                    : "none",
                }}
              >
                <Icon d={iconForCatalogApp(app.id)} />
              </button>
            </div>
          );
        })}
      </div>

      <div
        style={{
          flex: "none",
          width: "100%",
          borderTop: "1px solid var(--color-divider)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          padding: "var(--space-2) 0",
        }}
      >
        <button onClick={onOpenChannels} title="Channels" style={ICON_BTN}>
          <Icon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </button>
        {/* The chat control belongs to the rail, as it does in the mockup.
            A floating pill beside the rail crowded these buttons, so when the
            panel is closed this fills with the accent instead — attached,
            unmistakable, and it moves nothing else. */}
        <button
          onClick={onToggleChat}
          aria-label={chatOpen ? "Hide assistant chat" : "Open assistant chat"}
          title={chatOpen ? "Hide assistant chat" : "Open assistant chat"}
          style={{
            ...ICON_BTN,
            background: chatOpen ? "none" : "var(--color-accent)",
            color: chatOpen ? "var(--color-text)" : "#fff",
            boxShadow: chatOpen ? "none" : "var(--shadow-md)",
          }}
        >
          <Icon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </button>
        <button onClick={onOpenWallet} title="Wallet" style={{ ...ICON_BTN, position: "relative" }}>
          <Icon d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </button>
        <button onClick={onOpenConfig} title="System configuration" style={ICON_BTN}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
            <path d="M4 6h16M4 12h16M4 18h16" />
            <circle cx="9" cy="6" r="2" />
            <circle cx="15" cy="12" r="2" />
            <circle cx="9" cy="18" r="2" />
          </svg>
        </button>
        <button onClick={onCycleTheme} title="Theme" style={ICON_BTN}>
          <Icon d={themeIcon} />
        </button>
      </div>
    </nav>
  );
}
