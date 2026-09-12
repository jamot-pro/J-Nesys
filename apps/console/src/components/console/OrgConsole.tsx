"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrgPublicBranding } from "@jamot/client/branding";

import { AppRail } from "./AppRail";
import { ChatReopen } from "./ChatReopen";
import { ChatPanel } from "./ChatPanel";
import { Channels } from "./Channels";
import { DiscoverDreams } from "./DiscoverDreams";
import { SystemConfig } from "./SystemConfig";
import { getOrganizationApps, listNotifications, type AppManifest } from "@jamot/client";
import type { RailApp } from "./mockup-data";
import { useOrgScope } from "../console-context";
import { CommerceSection } from "../CommerceSection";
import { LeadGen } from "./LeadGen";
import { Notifications } from "./Notifications";
import { People } from "./People";
import { OutreachSection } from "../OutreachSection";

/** Rail apps that already have a backend behind them. Their screens are not
 * yet re-skinned to the corresponding mockup (LeadGen.dc.html, Outreach.dc.html,
 * Commerce.dc.html) — they carry real data in design-system components, and the
 * mockup's own layout for each is still to be ported. */
const WIRED: Record<string, React.ReactNode> = {
  channels: <Channels />,
  crm: <People />,
  "lead-generation": <LeadGen />,
  outreach: <OutreachSection />,
  commerce: <CommerceSection />,
};

/** Surfaces that live in the rail's lower group rather than the app catalog:
 * they are part of the console itself, so they cannot be installed or
 * deactivated and must survive a change to the enabled apps. */
const PLATFORM_SURFACES = new Set(["channels", "notifications", "wallet", "config"]);

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
  const { organizationId, spaceId } = useOrgScope();
  const [unread, setUnread] = useState(0);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(360);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [apps, setApps] = useState<RailApp[]>([]);

  // The rail is the organization's enabled apps, in enabledAppIds order —
  // which is what the Apps settings claims ("Activated apps appear in the
  // rail; order here is rail order"). Reloaded when the settings dialog
  // closes, since that is where the list changes.
  const loadApps = useCallback(async () => {
    try {
      const allocation = await getOrganizationApps(organizationId);
      const byId = new Map<string, AppManifest & { enabled: boolean }>(
        allocation.apps.map((a) => [a.id, a]),
      );
      setApps(
        allocation.enabledAppIds
          .map((id) => byId.get(id))
          .filter((a): a is AppManifest & { enabled: boolean } => Boolean(a))
          .map((a) => ({ id: a.id, title: a.name, icon: a.id, blurb: a.description })),
      );
    } catch {
      // A rail that cannot load its apps should still render the shell.
      setApps([]);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  // Deactivating the app you are looking at used to leave its screen up with
  // no title, because the rail no longer carried it. Fall back to Discover
  // unless the open surface is a platform one, which is not installable.
  useEffect(() => {
    if (!activeApp || PLATFORM_SURFACES.has(activeApp)) return;
    if (!apps.some((a) => a.id === activeApp)) setActiveApp(null);
  }, [apps, activeApp]);
  const [dark, setDark] = useState(true);

  /* The badge is polled rather than pushed: there is no realtime channel for
     notifications yet, and a stale count is worse than a slightly late one.
     It also refreshes whenever the reader leaves the notifications surface,
     so marking things read there is reflected immediately. */
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const items = await listNotifications(spaceId);
        if (!cancelled) setUnread(items.filter((n) => !n.read).length);
      } catch {
        // A failed poll leaves the last known count alone.
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [spaceId, activeApp]);

  // The mockup switches theme with body[data-theme], and its own .mark-light /
  // .mark-dark rules key off the same attribute — so the wordmark and logo
  // swap for free rather than needing per-image logic here.
  useEffect(() => {
    document.body.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  const current = apps.find((a) => a.id === activeApp) ?? null;

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
        apps={apps}
        activeId={activeApp}
        onOpenApp={(id) => setActiveApp(id)}
        onHome={() => setActiveApp(null)}
        onOpenWallet={() => setActiveApp("wallet")}
        onOpenChannels={() => setActiveApp("channels")}
        onOpenNotifications={() => setActiveApp("notifications")}
        unreadCount={unread}
        chatDocked={!chatOpen}
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
          ) : activeApp === "notifications" ? (
            <Notifications
              /* Triggers name sections this console may not have ported yet
                 (tasks, for one). Navigating to one of those would land on the
                 placeholder, so only known surfaces are followed. */
              onOpenSection={(section) => {
                if (WIRED[section] || PLATFORM_SURFACES.has(section)) setActiveApp(section);
              }}
            />
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

      {configOpen ? (
        <SystemConfig
          onClose={() => {
            setConfigOpen(false);
            void loadApps();
          }}
        />
      ) : null}
    </div>
  );
}
