"use client";

import { useEffect, useState } from "react";
import type { OrgPublicBranding } from "@jamot/client/branding";

import { AppRail } from "./AppRail";
import { ChatPanel } from "./ChatPanel";
import { ChatReopen } from "./ChatReopen";
import { DiscoverDreams } from "./DiscoverDreams";
import { SystemConfig } from "./SystemConfig";
import { APPS } from "./mockup-data";
import { CommerceSection } from "../CommerceSection";
import { LeadGen } from "./LeadGen";
import { OutreachSection } from "../OutreachSection";

/** Rail apps that already have a backend behind them. Their screens are not
 * yet re-skinned to the corresponding mockup (LeadGen.dc.html, Outreach.dc.html,
 * Commerce.dc.html) — they carry real data in design-system components, and the
 * mockup's own layout for each is still to be ported. */
const WIRED: Record<string, React.ReactNode> = {
  leadgen: <LeadGen />,
  outreach: <OutreachSection />,
  commerce: <CommerceSection />,
};

const SUN = "M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4";
const MOON = "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z";

/**
 * Org Console — the shell from templates/org-console/OrgConsole.dc.html.
 *
 * Layout, spacing, colour and markup are the mockup's, ported verbatim. The
 * only thing taken from the existing system is the API: the organization and
 * session come from the backend, everything else still renders the mockup's
 * own content until the matching endpoint is wired.
 *
 * One deliberate departure from the mockup: there is no org rail. This console
 * is mono-org — it serves the single organization named by the subdomain — so
 * a rail for switching between organizations has nothing to switch to.
 */
export function OrgConsole({ branding }: { branding: OrgPublicBranding }) {
  const [chatOpen, setChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(360);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [dark, setDark] = useState(true);

  // The mockup switches theme with body[data-theme], and its own .mark-light /
  // .mark-dark rules key off the same attribute — so the wordmark and logo
  // swap for free rather than needing per-image logic here.
  useEffect(() => {
    document.body.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  const current = APPS.find((a) => a.id === activeApp) ?? null;

  return (
    <div
      data-copilot-region="app-shell"
      style={{
        display: "flex",
        gap: 12,
        height: "100vh",
        width: "100%",
        padding: 12,
        overflow: "hidden",
        background: "var(--color-surface)",
      }}
    >
      {chatOpen ? (
        <ChatPanel width={chatWidth} onWidthChange={setChatWidth} onCollapse={() => setChatOpen(false)} />
      ) : (
        <ChatReopen onOpen={() => setChatOpen(true)} />
      )}

      <AppRail
        apps={APPS}
        activeId={activeApp}
        onOpenApp={(id) => setActiveApp(id)}
        onHome={() => setActiveApp(null)}
        onToggleChat={() => setChatOpen((v) => !v)}
        chatOpen={chatOpen}
        onOpenWallet={() => setActiveApp("wallet")}
        onOpenConfig={() => setConfigOpen(true)}
        onCycleTheme={() => setDark((v) => !v)}
        themeIcon={dark ? SUN : MOON}
      />

      <main
        data-copilot-region="workspace"
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--color-bg)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-md)",
          overflow: "hidden",
        }}
      >
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "var(--space-6)" }}>
          {activeApp === null ? (
            <DiscoverDreams />
          ) : WIRED[activeApp] ? (
            WIRED[activeApp]
          ) : (
            <div data-copilot-region={`app-${activeApp}`}>
              <span style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-ink)" }}>
                {branding.displayName}
              </span>
              <h1 style={{ margin: "6px 0 0", fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
                {current?.title ?? activeApp}
              </h1>
              <p
                style={{
                  margin: "var(--space-2) 0 0",
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: "color-mix(in srgb, var(--color-text) 76%, transparent)",
                  maxWidth: "60ch",
                }}
              >
                {current?.blurb ?? "This section of the mockup has not been ported yet."}
              </p>
              <div
                style={{
                  marginTop: "var(--space-6)",
                  border: "1px solid var(--color-divider)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-4)",
                  maxWidth: "60ch",
                }}
              >
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
                  Not ported yet. The mockup&rsquo;s own screen for this app is the reference; it is being brought
                  across one section at a time, and will replace this panel.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {configOpen ? <SystemConfig onClose={() => setConfigOpen(false)} /> : null}
    </div>
  );
}
